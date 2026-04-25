const mysql = require('mysql2/promise');
const https = require('https');
const crypto = require('crypto');
const tcb = require('@cloudbase/node-sdk');

const app = tcb.init({ env: process.env.TCB_ENV_ID || 'shop-manage-d6gsos8yoe6002412' });
const auth = app.auth();
const ENV_ID = process.env.TCB_ENV_ID || 'shop-manage-d6gsos8yoe6002412';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'sh-cynosdbmysql-grp-43hug5h6.sql.tencentcdb.com',
  port: parseInt(process.env.DB_PORT || '25967'),
  user: process.env.DB_USER || 'tcb_user',
  password: process.env.DB_PASSWORD || 'TcbUser@2026pass',
  database: process.env.DB_NAME || 'shop-manage-d6gsos8yoe6002412',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ============================================================
// Call TCB Admin API — uses metadata credentials when available
// ============================================================

function doGet(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? require('https') : require('http');
    const req = mod.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    if (options.timeout) {
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    }
  });
}

async function getCredentials() {
  // Try SCF metadata endpoint for TCB_QcsRole temp credentials
  try {
    const roleName = process.env.ROLE_NAME || 'TCB_QcsRole';
    const metaUrl = `http://metadata.tencentyun.com/latest/meta-data/cam/security-credentials/${roleName}`;
    const raw = await doGet(metaUrl, { timeout: 2000 });
    const parsed = JSON.parse(raw);
    if (parsed.TmpSecretId && parsed.TmpSecretKey) {
      console.log('[creds] metadata ok, secretId:', parsed.TmpSecretId.substring(0, 10) + '...');
      return { secretId: parsed.TmpSecretId, secretKey: parsed.TmpSecretKey, token: parsed.Token };
    }
  } catch (e) {
    console.log('[creds] metadata failed:', e.message);
  }

  // Fallback to SCF environment variables
  const sid = process.env.TENCENTCLOUD_SECRETID;
  const skey = process.env.TENCENTCLOUD_SECRETKEY;
  const token = process.env.TENCENTCLOUD_SESSIONTOKEN;
  if (sid && skey) {
    console.log('[creds] env vars ok, secretId:', sid.substring(0, 10) + '...');
    return { secretId: sid, secretKey: skey, token: token || '' };
  }

  throw new Error('No credentials available for TCB API call');
}

// TC3-HMAC-SHA256 signing (CloudAPI v3)
function tc3Sign(secretId, secretKey, payload, action, timestamp, token) {
  const date = new Date(timestamp * 1000).toISOString().split('T')[0];
  const host = 'tcb.tencentcloudapi.com';
  const service = 'tcb';
  const algorithm = 'TC3-HMAC-SHA256';

  const hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');

  const canonicalRequest = [
    'POST', '/', '',
    `content-type:application/json; charset=utf-8`,
    `host:${host}`,
    `x-tc-action:${action.toLowerCase()}`,
    '',
    'content-type;host;x-tc-action',
    hashedPayload,
  ].join('\n');

  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanon = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = [algorithm, timestamp, credentialScope, hashedCanon].join('\n');

  const secretDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`;

  return authorization;
}

async function callTcbApi(action, params) {
  const { secretId, secretKey, token } = await getCredentials();

  const body = JSON.stringify(params);
  const timestamp = Math.floor(Date.now() / 1000);
  const authorization = tc3Sign(secretId, secretKey, body, action, timestamp, token);

  const headers = {
    'Authorization': authorization,
    'Content-Type': 'application/json; charset=utf-8',
    'Host': 'tcb.tencentcloudapi.com',
    'X-TC-Action': action,
    'X-TC-Version': '2018-06-08',
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Region': 'ap-shanghai',
  };
  if (token) {
    headers['X-TC-Token'] = token;
  }

  console.log(`[TCB API] ${action} version=2018-06-08 params:`, JSON.stringify(params).substring(0, 200));

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'tcb.tencentcloudapi.com',
      port: 443,
      path: '/',
      method: 'POST',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`[TCB API] ${action} response keys:`, Object.keys(parsed));
          if (parsed.Response?.Error) {
            console.log(`[TCB API] Error:`, parsed.Response.Error.Code, parsed.Response.Error.Message);
          }
          resolve(parsed);
        } catch (e) {
          console.log(`[TCB API] Parse failed:`, data.substring(0, 300));
          reject(new Error(`Failed to parse TCB API response: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', (e) => {
      console.log(`[TCB API] Request error:`, e.message);
      reject(e);
    });
    req.write(body);
    req.end();
  });
}

// ============================================================
// Helper: sync CloudBase Auth user to MySQL users table
// On first login, creates a MySQL row. Always updates latest info.
// ============================================================

async function ensureUserInMySQL(tcbUid) {
  const [{ userInfo }] = await auth.getEndUserInfo(tcbUid);
  const profile = userInfo || {};

  const [rows] = await pool.query('SELECT id FROM users WHERE tcb_uid = ?', [tcbUid]);
  if (rows.length > 0) {
    // Update existing row
    await pool.query(
      'UPDATE users SET name = ?, email = ?, phone = ?, updated_at = NOW() WHERE tcb_uid = ?',
      [profile.name || profile.nickName || profile.username || tcbUid, profile.email || '', profile.phone || '', tcbUid]
    );
    return rows[0].id;
  }

  // Create new row
  const [result] = await pool.query(
    'INSERT INTO users (name, email, phone, role, status, tcb_uid) VALUES (?, ?, ?, ?, ?, ?)',
    [
      profile.name || profile.nickName || profile.username || tcbUid,
      profile.email || '',
      profile.phone || '',
      'operator',
      'active',
      tcbUid,
    ]
  );
  return result.insertId;
}

// ============================================================
// Dashboard
// ============================================================

async function getDashboard() {
  const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
  const [products] = await pool.query('SELECT COUNT(*) as count FROM products');
  const [orders] = await pool.query('SELECT COUNT(*) as count FROM orders');
  const [total] = await pool.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders');
  const [unpaid] = await pool.query("SELECT COALESCE(SUM(total_amount), 0) as unpaid FROM orders WHERE settlement_status != 'settled'");
  const [recentOrders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
  const [lowStock] = await pool.query(
    'SELECT * FROM products WHERE CAST(stock_quantity AS DECIMAL) < 10 ORDER BY stock_quantity ASC LIMIT 5'
  );

  return {
    users: users[0].count,
    products: products[0].count,
    orders: orders[0].count,
    totalAmount: parseFloat(total[0].total),
    unpaidAmount: parseFloat(unpaid[0].unpaid),
    recentOrders,
    lowStockProducts: lowStock,
  };
}

// ============================================================
// Users
// ============================================================

async function getUsers(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  const [{ count }] = await pool.query('SELECT COUNT(*) as count FROM users');
  return { data: rows, total: count };
}

async function getUser(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0] || null;
}

async function updateUser(id, { name, email, role, phone, status }) {
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (email !== undefined) { fields.push('email = ?'); values.push(email); }
  if (role !== undefined) { fields.push('role = ?'); values.push(role); }
  if (phone !== undefined) { fields.push('phone = ?'); values.push(phone); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  fields.push('updated_at = NOW()');
  values.push(id);

  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function deleteUser(id) {
  const [rows] = await pool.query('SELECT tcb_uid FROM users WHERE id = ?', [id]);
  if (rows.length > 0 && rows[0].tcb_uid) {
    // TODO: CloudBase Auth user deletion would go here
    // For now, just remove from MySQL
  }
  await pool.query('DELETE FROM users WHERE id = ?', [id]);
}

// Sync CloudBase Auth user to MySQL
async function syncUser(tcbUid) {
  const mysqlId = await ensureUserInMySQL(tcbUid);
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [mysqlId]);
  return rows[0];
}

// Sync ALL CloudBase Auth users to MySQL
async function syncAllUsers() {
  let allUsers = [];
  let pageNo = 1;
  const pageSize = 100;

  // Fetch all users via TCB internal API
  while (true) {
    const res = await callTcbApi('DescribeUserList', {
      EnvId: ENV_ID,
      PageNo: pageNo,
      PageSize: pageSize,
    });
    console.log(`Page ${pageNo} raw response keys:`, Object.keys(res));

    // Try various response formats
    let userList = [];
    if (res.Response?.Data?.UserList) {
      userList = res.Response.Data.UserList;
    } else if (res.Data?.UserList) {
      userList = res.Data.UserList;
    } else if (res.UserList) {
      userList = res.UserList;
    } else if (res.data?.UserList) {
      userList = res.data.UserList;
    } else if (res.Response?.UserList) {
      userList = res.Response.UserList;
    } else {
      console.log('DescribeUserList full response:', JSON.stringify(res).substring(0, 800));
    }

    if (userList.length === 0) {
      console.log(`No users on page ${pageNo}, stopping`);
      break;
    }
    allUsers = allUsers.concat(userList);
    console.log(`Page ${pageNo}: got ${userList.length} users, total so far: ${allUsers.length}`);
    if (userList.length < pageSize) break;
    pageNo++;
  }

  let synced = 0;
  for (const u of allUsers) {
    const uid = u.Uid || u.uid;
    if (!uid) continue;
    const name = u.Name || u.nickName || u.username || uid;
    const email = u.Email || u.email || '';
    const phone = u.Phone || u.phone || '';
    try {
      const [rows] = await pool.query('SELECT id FROM users WHERE tcb_uid = ?', [uid]);
      if (rows.length === 0) {
        await pool.query(
          'INSERT INTO users (name, email, phone, role, status, tcb_uid) VALUES (?, ?, ?, ?, ?, ?)',
          [name, email, phone, 'operator', 'active', uid]
        );
        synced++;
      } else {
        await pool.query(
          'UPDATE users SET name = ?, email = ?, phone = ?, updated_at = NOW() WHERE tcb_uid = ?',
          [name, email, phone, uid]
        );
      }
    } catch (e) {
      console.error(`Failed to sync user ${uid}:`, e.message);
    }
  }

  return { synced, total: allUsers.length };
}

// ============================================================
// Products
// ============================================================

async function getProducts(page = 1, limit = 20, keyword = '') {
  const offset = (page - 1) * limit;
  let sql = 'SELECT * FROM products';
  let countSql = 'SELECT COUNT(*) as count FROM products';
  const params = [];

  if (keyword) {
    sql += ' WHERE name LIKE ? OR sku LIKE ?';
    countSql += ' WHERE name LIKE ? OR sku LIKE ?';
    const like = `%${keyword}%`;
    params.push(like, like);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(sql, params);
  const [{ count }] = await pool.query(countSql, params.slice(0, keyword ? 2 : 0));
  return { data: rows, total: count };
}

async function getProduct(id) {
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [id]);
  return rows[0] || null;
}

async function createProduct({ name, sku = '', unit = '', unitPrice = '', costPrice = '', stockQuantity = '0', status = 'active', createdBy = null }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      'INSERT INTO products (name, sku, unit, unit_price, cost_price, stock_quantity, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, sku, unit, unitPrice, costPrice, stockQuantity, status, createdBy]
    );
    const productId = result.insertId;

    // Record initial inventory transaction
    const qty = parseFloat(stockQuantity) || 0;
    if (qty !== 0) {
      await connection.query(
        'INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change, quantity_before, quantity_after, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [productId, 'initial', qty, 0, qty, 'product_create', '初始库存']
      );
    }

    await connection.commit();
    return productId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function updateProduct(id, { name, sku, unit, unitPrice, costPrice, stockQuantity, status }) {
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (sku !== undefined) { fields.push('sku = ?'); values.push(sku); }
  if (unit !== undefined) { fields.push('unit = ?'); values.push(unit); }
  if (unitPrice !== undefined) { fields.push('unit_price = ?'); values.push(unitPrice); }
  if (costPrice !== undefined) { fields.push('cost_price = ?'); values.push(costPrice); }
  if (stockQuantity !== undefined) { fields.push('stock_quantity = ?'); values.push(stockQuantity); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  fields.push('updated_at = NOW()');
  values.push(id);

  await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id = ?', [id]);
}

// ============================================================
// Orders
// ============================================================

async function getOrders(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    'SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  const [{ count }] = await pool.query('SELECT COUNT(*) as count FROM orders');
  return { data: rows, total: count };
}

async function getOrder(id) {
  const [rows] = await pool.query('SELECT * FROM orders WHERE id = ?', [id]);
  const order = rows[0] || null;
  if (order) {
    const [items] = await pool.query(
      'SELECT oi.*, p.name as product_name, p.sku as product_sku FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?',
      [id]
    );
    order.items = items;
  }
  return order;
}

async function createOrder(orderData) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const orderNo = 'ORD' + Date.now();
    const [result] = await connection.query(
      'INSERT INTO orders (order_no, buyer_name, buyer_phone, total_amount, settlement_status, settled_amount, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orderNo, orderData.buyerName, orderData.buyerPhone, orderData.totalAmount, orderData.settlementStatus || 'unsettled', orderData.settledAmount || '0', orderData.notes, orderData.createdBy]
    );
    const orderId = result.insertId;

    if (orderData.items && orderData.items.length > 0) {
      for (const item of orderData.items) {
        await connection.query(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
          [orderId, item.productId, item.quantity, item.unitPrice, item.totalPrice]
        );
        // Get current stock before update
        const [[{ stock_quantity: currentStock }]] = await connection.query(
          'SELECT stock_quantity FROM products WHERE id = ?',
          [item.productId]
        );
        const qty = parseFloat(item.quantity) || 0;
        const before = parseFloat(currentStock) || 0;
        const after = before - qty;
        // Update stock
        await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = NOW() WHERE id = ?',
          [item.quantity, item.productId]
        );
        // Record inventory transaction
        await connection.query(
          'INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [item.productId, 'out', -qty, before, after, 'order', orderId, `订单 ${orderNo} 出库`]
        );
      }
    }

    await connection.commit();
    return orderId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function updateOrder(id, { buyerName, buyerPhone, settlementStatus, settledAmount, notes }) {
  const fields = [];
  const values = [];
  if (buyerName !== undefined) { fields.push('buyer_name = ?'); values.push(buyerName); }
  if (buyerPhone !== undefined) { fields.push('buyer_phone = ?'); values.push(buyerPhone); }
  if (settlementStatus !== undefined) { fields.push('settlement_status = ?'); values.push(settlementStatus); }
  if (settledAmount !== undefined) { fields.push('settled_amount = ?'); values.push(settledAmount); }
  if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
  fields.push('updated_at = NOW()');
  values.push(id);

  await pool.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function deleteOrder(id) {
  await pool.query('DELETE FROM order_items WHERE order_id = ?', [id]);
  await pool.query('DELETE FROM orders WHERE id = ?', [id]);
}

async function payOrder(id) {
  await pool.query(
    'UPDATE orders SET settlement_status = ?, updated_at = NOW() WHERE id = ?',
    ['settled', id]
  );
}

// ============================================================
// Restock (进货)
// ============================================================

async function createRestock({ productId, quantity, notes, createdBy }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[{ stock_quantity: currentStock }]] = await connection.query(
      'SELECT stock_quantity FROM products WHERE id = ?',
      [productId]
    );
    const qty = parseFloat(quantity) || 0;
    const before = parseFloat(currentStock) || 0;
    const after = before + qty;

    await connection.query(
      'UPDATE products SET stock_quantity = stock_quantity + ?, updated_at = NOW() WHERE id = ?',
      [quantity, productId]
    );

    await connection.query(
      'INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [productId, 'in', qty, before, after, 'restock', null, notes || '进货入库', createdBy]
    );

    await connection.commit();
    return { success: true };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// ============================================================
// Bills (Inventory Transactions)
// ============================================================

async function getBills(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const [rows] = await pool.query(
    `SELECT it.*, p.name as product_name
     FROM inventory_transactions it
     LEFT JOIN products p ON it.product_id = p.id
     ORDER BY it.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  const [countResult] = await pool.query('SELECT COUNT(*) as count FROM inventory_transactions');
  const total = Number(countResult[0].count);
  return { data: rows, total };
}

// ============================================================
// Main Handler
// ============================================================

exports.main = async (event, context) => {
  const { action, data = {} } = typeof event === 'string' ? JSON.parse(event) : event;

  // Get caller's CloudBase UID for auto-sync
  let callerUid = null;
  try {
    const { uid } = auth.getUserInfo();
    if (uid && uid !== 'anonymous') callerUid = uid;
  } catch { /* no auth context */ }

  try {
    let result;
    switch (action) {
      // Dashboard
      case 'dashboard':
        result = await getDashboard();
        break;

      // Users
      case 'users.list':
        result = await getUsers(data.page, data.limit);
        break;
      case 'users.get':
        result = await getUser(data.id);
        break;
      case 'users.sync':
        result = await syncUser(data.tcbUid);
        break;
      case 'users.syncAll':
        result = await syncAllUsers();
        break;
      case 'users.update':
        await updateUser(data.id, data);
        result = { success: true };
        break;
      case 'users.delete':
        await deleteUser(data.id);
        result = { success: true };
        break;

      // Products
      case 'products.list':
        result = await getProducts(data.page, data.limit, data.keyword);
        break;
      case 'products.get':
        result = await getProduct(data.id);
        break;
      case 'products.create':
        result = await createProduct(data);
        break;
      case 'products.update':
        await updateProduct(data.id, data);
        result = { success: true };
        break;
      case 'products.delete':
        await deleteProduct(data.id);
        result = { success: true };
        break;

      // Restock
      case 'products.restock':
        result = await createRestock(data);
        break;

      // Orders
      case 'orders.list':
        result = await getOrders(data.page, data.limit);
        break;
      case 'orders.get':
        result = await getOrder(data.id);
        break;
      case 'orders.create':
        result = await createOrder(data);
        break;
      case 'orders.update':
        await updateOrder(data.id, data);
        result = { success: true };
        break;
      case 'orders.delete':
        await deleteOrder(data.id);
        result = { success: true };
        break;
      case 'orders.pay':
        await payOrder(data.id);
        result = { success: true };
        break;

      // Bills
      case 'bills.list':
        result = await getBills(data.page, data.limit);
        break;

      default:
        return { code: -1, message: `Unknown action: ${action}`, data: null };
    }

    return { code: 0, message: 'success', data: result };
  } catch (error) {
    console.error('Shop API error:', error);
    return { code: -1, message: error.message || 'Internal server error', data: null };
  }
};
