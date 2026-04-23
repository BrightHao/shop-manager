const mysql = require('mysql2/promise');

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
// Dashboard
// ============================================================

async function getDashboard() {
  const [users] = await pool.query('SELECT COUNT(*) as count FROM users');
  const [products] = await pool.query('SELECT COUNT(*) as count FROM products');
  const [orders] = await pool.query('SELECT COUNT(*) as count FROM orders');
  const [total] = await pool.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM orders');
  const [recentOrders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5');
  const [lowStock] = await pool.query(
    'SELECT * FROM products WHERE CAST(stock_quantity AS DECIMAL) < 10 ORDER BY stock_quantity ASC LIMIT 5'
  );

  return {
    users: users[0].count,
    products: products[0].count,
    orders: orders[0].count,
    totalAmount: parseFloat(total[0].total),
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

async function createUser({ name, email, passwordHash, role = 'operator', phone = '', status = 'active' }) {
  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, passwordHash, role, phone, status]
  );
  return result.insertId;
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
  await pool.query('DELETE FROM users WHERE id = ?', [id]);
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

async function createProduct({ name, sku = '', unit = '个', unitPrice = '0', stockQuantity = '0', status = 'active', createdBy = null }) {
  const [result] = await pool.query(
    'INSERT INTO products (name, sku, unit, unit_price, stock_quantity, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, sku, unit, unitPrice, stockQuantity, status, createdBy]
  );
  return result.insertId;
}

async function updateProduct(id, { name, sku, unit, unitPrice, stockQuantity, status }) {
  const fields = [];
  const values = [];
  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (sku !== undefined) { fields.push('sku = ?'); values.push(sku); }
  if (unit !== undefined) { fields.push('unit = ?'); values.push(unit); }
  if (unitPrice !== undefined) { fields.push('unit_price = ?'); values.push(unitPrice); }
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
        // Update stock
        await connection.query(
          'UPDATE products SET stock_quantity = stock_quantity - ?, updated_at = NOW() WHERE id = ?',
          [item.quantity, item.productId]
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
  const [{ count }] = await pool.query('SELECT COUNT(*) as count FROM inventory_transactions');
  return { data: rows, total: count };
}

// ============================================================
// Main Handler
// ============================================================

exports.main = async (event, context) => {
  const { action, data = {} } = typeof event === 'string' ? JSON.parse(event) : event;

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
      case 'users.create':
        result = await createUser(data);
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
