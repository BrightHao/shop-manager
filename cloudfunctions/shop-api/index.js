const mysql = require('mysql2/promise');
const https = require('https');
const crypto = require('crypto');
const tcb = require('@cloudbase/node-sdk');

const app = tcb.init({ env: process.env.TCB_ENV_ID || 'shop-manage-d6gsos8yoe6002412' });
const auth = app.auth();
const ENV_ID = process.env.TCB_ENV_ID || 'shop-manage-d6gsos8yoe6002412';

function createPool() {
  return mysql.createPool({
    host: process.env.DB_HOST || 'sh-cynosdbmysql-grp-43hug5h6.sql.tencentcdb.com',
    port: parseInt(process.env.DB_PORT || '25967'),
    user: process.env.DB_USER || 'tcb_user',
    password: process.env.DB_PASSWORD || 'TcbUser@2026pass',
    database: process.env.DB_NAME || 'shop-manage-d6gsos8yoe6002412',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    acquireTimeout: 10000,
    timeout: 30000,
  });
}

let pool = createPool();
let poolRecreating = false;

// Get a healthy connection with retry on failure
async function getConnection(retries = 0) {
  try {
    const conn = await pool.getConnection();
    return conn;
  } catch (e) {
    // Only retry on connection-level errors (pool stale, network reset, etc.)
    const isRetryable = e.code === 'ECONNRESET' ||
      e.message.includes('Malformed') ||
      e.message.includes('ER_CON_COUNT_ERROR') ||
      e.message.includes('PROTOCOL_CONNECTION_LOST') ||
      e.message.includes('getaddrinfo') ||
      (retries === 0 && e.code === 'ECONNREFUSED');

    if (!isRetryable || retries >= 3) throw e;

    // Serialize pool recreation to avoid racing multiple invocations
    if (!poolRecreating) {
      poolRecreating = true;
      console.log(`[pool] connection failed (attempt ${retries + 1}), recreating:`, e.message);
      try {
        pool.end().catch(() => {});
        pool = createPool();
      } finally {
        poolRecreating = false;
      }
    } else {
      // Another invocation is recreating, wait a moment
      await new Promise(r => setTimeout(r, 200));
    }

    return getConnection(retries + 1);
  }
}

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
  const [recentOrders] = await pool.query(
    'SELECT id, order_no, buyer_name, buyer_phone, total_amount, settlement_status, settled_amount, notes, created_by, ' +
    'DATE_FORMAT(created_at, \'%Y-%m-%d %H:%i:%s\') as created_at, ' +
    'DATE_FORMAT(updated_at, \'%Y-%m-%d %H:%i:%s\') as updated_at ' +
    'FROM orders ORDER BY created_at DESC LIMIT 5'
  );

  // Fetch items for recent orders
  if (recentOrders.length > 0) {
    const orderIds = recentOrders.map(o => o.id);
    const [items] = await pool.query(
      'SELECT oi.order_id, p.name as product_name FROM order_items oi ' +
      'JOIN products p ON oi.product_id = p.id WHERE oi.order_id IN (?) ORDER BY oi.id ASC',
      [orderIds]
    );
    const itemsMap = new Map();
    for (const item of items) {
      if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
      itemsMap.get(item.order_id).push(item.product_name);
    }
    for (const order of recentOrders) {
      order.items = itemsMap.get(order.id) || [];
    }
  }

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
    'SELECT id, name, email, phone, role, status, tcb_uid, ' +
    'DATE_FORMAT(created_at, \'%Y-%m-%d %H:%i:%s\') as created_at, ' +
    'DATE_FORMAT(updated_at, \'%Y-%m-%d %H:%i:%s\') as updated_at ' +
    'FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  const [{ count }] = await pool.query('SELECT COUNT(*) as count FROM users');
  return { data: rows, total: count };
}

async function getUser(id) {
  const [rows] = await pool.query(
    'SELECT id, name, email, phone, role, status, tcb_uid, ' +
    'DATE_FORMAT(created_at, \'%Y-%m-%d %H:%i:%s\') as created_at, ' +
    'DATE_FORMAT(updated_at, \'%Y-%m-%d %H:%i:%s\') as updated_at ' +
    'FROM users WHERE id = ?', [id]);
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
  const [rows] = await pool.query(
    'SELECT id, name, email, phone, role, status, tcb_uid, ' +
    'DATE_FORMAT(created_at, \'%Y-%m-%d %H:%i:%s\') as created_at, ' +
    'DATE_FORMAT(updated_at, \'%Y-%m-%d %H:%i:%s\') as updated_at ' +
    'FROM users WHERE id = ?', [mysqlId]);
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
  let sql = 'SELECT p.id, p.name, p.sku, p.unit, p.unit_price, p.cost_price, p.stock_quantity, p.status, p.category_id, p.created_by, ' +
    'DATE_FORMAT(p.created_at, \'%Y-%m-%d %H:%i:%s\') as created_at, ' +
    'DATE_FORMAT(p.updated_at, \'%Y-%m-%d %H:%i:%s\') as updated_at, ' +
    'c.name as category_name ' +
    'FROM products p LEFT JOIN categories c ON p.category_id = c.id';
  let countSql = 'SELECT COUNT(*) as count FROM products p';
  const params = [];
  const countParams = [];

  if (keyword) {
    sql += ' WHERE (p.name LIKE ? OR p.sku LIKE ?)';
    countSql += ' WHERE (p.name LIKE ? OR p.sku LIKE ?)';
    const like = `%${keyword}%`;
    params.push(like, like);
    countParams.push(like, like);
  }

  sql += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(sql, params);
  const countRows = await pool.query('SELECT COUNT(*) as count FROM products p');
  const count = Number(countRows[0]?.[0]?.count ?? 0);
  return { data: rows, total: count };
}

async function getProduct(id) {
  const [rows] = await pool.query(
    'SELECT p.id, p.name, p.sku, p.unit, p.unit_price, p.cost_price, p.stock_quantity, p.status, p.category_id, p.created_by, ' +
    'DATE_FORMAT(p.created_at, \'%Y-%m-%d %H:%i:%s\') as created_at, ' +
    'DATE_FORMAT(p.updated_at, \'%Y-%m-%d %H:%i:%s\') as updated_at, ' +
    'c.name as category_name ' +
    'FROM products p LEFT JOIN categories c ON p.category_id = c.id ' +
    'WHERE p.id = ?', [id]);
  return rows[0] || null;
}

async function createProduct({ name, sku = '', unit = '', unitPrice = '', costPrice = '', stockQuantity = '0', status = 'active', categoryId = null, createdBy = null }) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      'INSERT INTO products (name, sku, unit, unit_price, cost_price, stock_quantity, status, category_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, sku, unit, unitPrice, costPrice, stockQuantity, status, categoryId, createdBy]
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

async function updateProduct(id, { name, sku, unit, unitPrice, costPrice, stockQuantity, status, categoryId }) {
  const connection = await getConnection();
  try {
    const [stockRows] = await connection.query('SELECT stock_quantity FROM products WHERE id = ?', [id]);
    const before = parseFloat(stockRows[0]?.stock_quantity) || 0;
    const newQty = stockQuantity !== undefined ? parseFloat(stockQuantity) : before;
    const diff = newQty - before;

    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (sku !== undefined) { fields.push('sku = ?'); values.push(sku); }
    if (unit !== undefined) { fields.push('unit = ?'); values.push(unit); }
    if (unitPrice !== undefined) { fields.push('unit_price = ?'); values.push(unitPrice); }
    if (costPrice !== undefined) { fields.push('cost_price = ?'); values.push(costPrice); }
    if (stockQuantity !== undefined) { fields.push('stock_quantity = ?'); values.push(stockQuantity); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (categoryId !== undefined) { fields.push('category_id = ?'); values.push(categoryId); }
    fields.push('updated_at = NOW()');
    values.push(id);

    await connection.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, values);

    // Record inventory transaction if stock changed
    if (diff !== 0) {
      const txType = diff > 0 ? 'in' : 'out';
      await connection.query(
        'INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change, quantity_before, quantity_after, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, txType, diff, before, newQty, 'adjust', '商品库存调整']
      );
    }
  } finally {
    connection.release();
  }
}

async function deleteProduct(id) {
  await pool.query('DELETE FROM products WHERE id = ?', [id]);
}

async function getCategories() {
  const [rows] = await pool.query(
    'SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, id ASC'
  );
  return rows;
}

// ============================================================
// Orders
// ============================================================

async function getOrders(page = 1, limit = 20, paymentStatus, productKeyword) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  const countParams = [];

  if (paymentStatus === 'paid') {
    conditions.push("o.settlement_status = 'settled'");
  } else if (paymentStatus === 'unpaid') {
    conditions.push("o.settlement_status != 'settled'");
  }

  if (productKeyword) {
    conditions.push("EXISTS (SELECT 1 FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id AND p.name LIKE ?)");
    const like = `%${productKeyword}%`;
    params.push(like);
    countParams.push(like);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    'SELECT o.id, o.order_no, o.buyer_name, o.buyer_phone, o.total_amount, o.settlement_status, o.settled_amount, o.notes, o.created_by, ' +
    'DATE_FORMAT(o.created_at, \'%Y-%m-%d %H:%i:%s\') as created_at, ' +
    'DATE_FORMAT(o.updated_at, \'%Y-%m-%d %H:%i:%s\') as updated_at ' +
    `FROM orders o ${whereClause} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  // Fetch product names for each order
  if (rows.length > 0) {
    const orderIds = rows.map(o => o.id);
    const [items] = await pool.query(
      'SELECT oi.order_id, p.name as product_name FROM order_items oi ' +
      'JOIN products p ON oi.product_id = p.id WHERE oi.order_id IN (?) ORDER BY oi.id ASC',
      [orderIds]
    );
    const itemsMap = new Map();
    for (const item of items) {
      if (!itemsMap.has(item.order_id)) itemsMap.set(item.order_id, []);
      itemsMap.get(item.order_id).push(item.product_name);
    }
    for (const order of rows) {
      order.items = itemsMap.get(order.id) || [];
    }
  }

  const countRows = await pool.query(`SELECT COUNT(*) as count FROM orders o ${whereClause}`, countParams);
  const count = Number(countRows[0]?.[0]?.count ?? 0);
  return { data: rows, total: count };
}

async function getOrder(id) {
  const [rows] = await pool.query(
    'SELECT id, order_no, buyer_name, buyer_phone, total_amount, settlement_status, settled_amount, notes, created_by, ' +
    'DATE_FORMAT(created_at, \'%Y-%m-%d %H:%i:%s\') as created_at, ' +
    'DATE_FORMAT(updated_at, \'%Y-%m-%d %H:%i:%s\') as updated_at ' +
    'FROM orders WHERE id = ?', [id]);
  const order = rows[0] || null;
  if (order) {
    const [items] = await pool.query(
      'SELECT oi.*, p.name as product_name, p.sku as product_sku, p.unit as product_unit FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?',
      [id]
    );
    order.fullItems = items;
    order.items = items;
  }
  return order;
}

async function createOrder(orderData, callerUid) {
  const validItems = orderData.items?.filter(item => item.productId) || [];
  if (validItems.length === 0) {
    throw new Error('请至少选择一个商品');
  }
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const orderNo = 'ORD' + Date.now();
    let createdByVal = null;

    if (callerUid) {
      const [uidRows] = await connection.query('SELECT id FROM users WHERE tcb_uid = ?', [callerUid]);
      if (uidRows.length > 0) {
        createdByVal = uidRows[0].id;
      }
    }
    const [result] = await connection.query(
      'INSERT INTO orders (order_no, buyer_name, buyer_phone, total_amount, settlement_status, settled_amount, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orderNo, orderData.buyerName, orderData.buyerPhone, orderData.totalAmount, orderData.settlementStatus || 'unsettled', orderData.settledAmount || '0', orderData.notes, createdByVal]
    );
    const orderId = result.insertId;

    if (validItems.length > 0) {
      for (const item of validItems) {
        await connection.query(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
          [orderId, item.productId, item.quantity, item.unitPrice, item.totalPrice]
        );
        // Get current stock before update
        const [rows] = await connection.query(
          'SELECT stock_quantity FROM products WHERE id = ?',
          [item.productId]
        );
        if (rows.length > 0) {
          const qty = parseFloat(item.quantity) || 0;
          const before = parseFloat(rows[0].stock_quantity) || 0;
          const after = before - qty;
          await connection.query(
            'UPDATE products SET stock_quantity = ?, updated_at = NOW() WHERE id = ?',
            [after, item.productId]
          );
          await connection.query(
            'INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [item.productId, 'out', -qty, before, after, 'order', orderId, `订单 ${orderNo} 出库`]
          );
        }
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

async function updateOrder(id, { buyerName, buyerPhone, settlementStatus, settledAmount, notes, items }) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // Get order_no for inventory transaction notes
    const [orderRows] = await connection.query('SELECT order_no FROM orders WHERE id = ?', [id]);
    const orderNo = orderRows[0]?.order_no || String(id);

    // Update order items first if provided, then handle order fields
    if (items !== undefined) {
      const [oldItems] = await connection.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [id]
      );

      // Build maps for old items and new items
      const oldItemMap = new Map(oldItems.map(o => [String(o.product_id), parseFloat(o.quantity) || 0]));
      const newItemMap = new Map(items.filter(i => i.productId).map(i => [String(i.productId), parseFloat(i.quantity) || 0]));

      // First pass: compute all stock changes and apply updates
      for (const item of items) {
        if (!item.productId) continue;

        const [stockRows] = await connection.query(
          'SELECT stock_quantity FROM products WHERE id = ?',
          [item.productId]
        );
        if (stockRows.length === 0) continue;

        const newQty = newItemMap.get(String(item.productId)) || 0;
        const oldQty = oldItemMap.get(String(item.productId)) || 0;
        const diff = newQty - oldQty;

        if (diff === 0) continue;

        const before = parseFloat(stockRows[0].stock_quantity) || 0;
        const after = before + diff;

        // Update stock
        await connection.query(
          'UPDATE products SET stock_quantity = ?, updated_at = NOW() WHERE id = ?',
          [after, item.productId]
        );

        // Record inventory transaction
        const txType = diff > 0 ? 'in' : 'out';
        await connection.query(
          'INSERT INTO inventory_transactions (product_id, transaction_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [item.productId, txType, diff, before, after, 'order', id, `订单 ${orderNo} 修改`]
        );
      }

      // Delete old and insert new items
      await connection.query('DELETE FROM order_items WHERE order_id = ?', [id]);
      for (const item of items) {
        if (item.productId) {
          await connection.query(
            'INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
            [id, item.productId, item.quantity, item.unitPrice, item.totalPrice]
          );
        }
      }

      // Recalculate total from new items
      const total = items.reduce((sum, item) => sum + parseFloat(item.totalPrice || 0), 0);
      settledAmount = settledAmount ?? (settlementStatus === 'settled' ? total.toFixed(2) : '0');
      await connection.query(
        'UPDATE orders SET total_amount = ?, settled_amount = ?, notes = ?, buyer_name = ?, buyer_phone = ?, settlement_status = ?, updated_at = NOW() WHERE id = ?',
        [total.toFixed(2), settledAmount, notes, buyerName, buyerPhone, settlementStatus, id]
      );
    } else {
      const fields = [];
      const values = [];
      if (buyerName !== undefined) { fields.push('buyer_name = ?'); values.push(buyerName); }
      if (buyerPhone !== undefined) { fields.push('buyer_phone = ?'); values.push(buyerPhone); }
      if (settlementStatus !== undefined) { fields.push('settlement_status = ?'); values.push(settlementStatus); }
      if (settledAmount !== undefined) { fields.push('settled_amount = ?'); values.push(settledAmount); }
      if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
      fields.push('updated_at = NOW()');
      values.push(id);
      await connection.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
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
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const [stockRows] = await connection.query(
      'SELECT stock_quantity FROM products WHERE id = ?',
      [productId]
    );
    if (stockRows.length === 0) throw new Error('Product not found');
    const qty = parseFloat(quantity) || 0;
    const before = parseFloat(stockRows[0].stock_quantity) || 0;
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

async function getBills(page = 1, limit = 20, productKeyword, categoryId) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];
  const countParams = [];

  if (productKeyword) {
    conditions.push('p.name LIKE ?');
    const like = `%${productKeyword}%`;
    params.push(like);
    countParams.push(like);
  }

  if (categoryId) {
    conditions.push('p.category_id = ?');
    params.push(categoryId);
    countParams.push(categoryId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT it.id, it.product_id, it.transaction_type, it.quantity_change, it.quantity_before, it.quantity_after, it.reference_type, it.reference_id, it.notes, it.created_by,
     DATE_FORMAT(it.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
     p.name as product_name, p.category_id
     FROM inventory_transactions it
     LEFT JOIN products p ON it.product_id = p.id
     ${whereClause}
     ORDER BY it.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as count FROM inventory_transactions it LEFT JOIN products p ON it.product_id = p.id ${whereClause}`,
    countParams
  );
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
      case 'products.categories':
        result = await getCategories();
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
        result = await getOrders(data.page, data.limit, data.paymentStatus, data.productKeyword);
        break;
      case 'orders.get':
        result = await getOrder(data.id);
        break;
      case 'orders.create':
        result = await createOrder(data, callerUid);
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
        result = await getBills(data.page, data.limit, data.productKeyword, data.categoryId);
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
