require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const compression = require('compression');
const ExcelJS = require("exceljs");

// ✅ Allow your frontend on GitHub Pages
app.use(cors({
  origin: 'https://zaid444-max.github.io'
}));

const app = express();
app.use(cors());  // Allow requests from other devices
app.use(compression());
// Increase limit to, say, 20MB
app.use(express.json({ limit: "20mb" }));

app.use((req, res, next) => {   
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  

// Serve static frontend files
app.use(express.static("public")); // Serve frontend files

// MySQL Connection Pool
const db = mysql.createPool({
    connectionLimit: 10, // or adjust for your number of users
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  
console.log('MySQL pool initialized');
  
// Items:-----------

// Fetch all items
app.get('/items', (req, res) => {
    let sql = "SELECT i.id, b.name AS brand_name, m.name AS model_name, c.name AS category_name, q.name AS quality_name, i.quantity, i.buyPrice, i.priceOne, i.display_order, i.changingId, i.SKU, i.boxId, i.disable, i.noExcel, i.discription, c.circle_ball AS ball FROM items i JOIN brand b ON i.brand = b.id JOIN model m ON i.model = m.id JOIN category c ON i.category = c.id JOIN quality q ON i.quality = q.id ORDER BY i.display_order"
    db.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching items:', err);
            res.status(500).send(err);
            return;
        }
        res.json(results);
    });
});

// Fetch all items with filtering
app.get('/itemsFilter', (req, res) => {
    let limit = parseInt(req.query.limit, 10) || 70; // default to 1000000 if not provided
    const search = `%${req.query.search || ''}%`;
    const searchTerms  = search.toLocaleLowerCase().split(' ');
    const brandDivVal = req.query.brandDivVal === 'Select brand..' ? '' : req.query.brandDivVal;
    const categoryDivVal = !req.query.categoryDivVal ? false : req.query.categoryDivVal === 'Select category..' ? '' : req.query.categoryDivVal.replace(/plus/g, '+');
    let sql = "SELECT i.id, b.name AS brand_name, m.name AS model_name, c.name AS category_name, q.name AS quality_name, i.quantity, i.buyPrice, i.priceOne, i.display_order, i.changingId, i.SKU, i.boxId, i.disable, i.noExcel, i.discription, c.circle_ball AS ball FROM items i JOIN brand b ON i.brand = b.id JOIN model m ON i.model = m.id JOIN category c ON i.category = c.id JOIN quality q ON i.quality = q.id WHERE 1=1"
    const values = [];
    for(const term of searchTerms ) {
        sql += `
        AND (
            LOWER(b.name) LIKE ? OR
            LOWER(m.name) LIKE ? OR
            LOWER(q.name) LIKE ? OR
            LOWER(c.name) LIKE ? OR
            LOWER(i.SKU) LIKE ? OR
            LOWER(i.boxId) LIKE ? OR
            LOWER(i.discription) LIKE ?
        )
        `
        const wildcardTerm = `%${term}%`;
        values.push(wildcardTerm, wildcardTerm, wildcardTerm, wildcardTerm, wildcardTerm, wildcardTerm, wildcardTerm)
    }

    if (brandDivVal) {
        sql += `AND b.name = ?`;
        values.push(brandDivVal)
    }
    if (categoryDivVal) {
        sql += `AND c.name = ?`;
        values.push(categoryDivVal)
    }

    sql += ` ORDER BY i.display_order ASC LIMIT ?;`;
    values.push(limit);

    db.query(sql, values, (err, results) => {
        if (err) {
            console.error('Error fetching items:', err);
            res.status(500).send(err);
            return;
        }
        res.json(results);
    });
});

// Fetch an item by ID
app.get('/items/:id', (req, res) => {
    const itemId = req.params.id;
    const sql = 'SELECT i.id, b.name AS brand_name, b.id AS brand_id, m.name AS model_name, m.id AS model_id, c.name AS category_name, c.id AS category_id, q.name AS quality_name, q.id AS quality_id, i.quantity, i.buyPrice, i.priceOne, i.disable, i.noExcel, i.discription, i.SKU, i.boxId FROM items i JOIN brand b ON i.brand = b.id JOIN model m ON i.model = m.id JOIN category c ON i.category = c.id JOIN quality q ON i.quality = q.id WHERE i.id  = ?';
    db.query(sql, [itemId], (err, result) => {
        if (err) {
            console.error('Error fetching target item', err)
            return res.status(500).json({ error: 'Database error'});
        }
        if (result.length === 0) {
            return res.status(404).json({error: 'Item not found'});
        }
        res.json(result[0]);
    });
});

// Add a new item
app.post('/items', (req, res) => {
    const { id, SKU, boxId, disable, noExcel, brand, model, category, quality, quantity, buyPrice, priceOne, display_order, changingId } = req.body;
    const sql = 'INSERT INTO items (id, SKU, boxId, disable, noExcel, brand, model, category, quality, quantity, buyPrice, priceOne, display_order, changingId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(sql, [id, SKU, boxId, disable, noExcel, brand, model, category, quality, quantity, buyPrice, priceOne, display_order, changingId], (err, result) => {
        if (err) {
            console.error('Error adding item:', err);
            res.status(500).send(err);
            return;
        }
        res.json({ id: result.insertId, ...req.body });
    });
});

// add an order to the items
app.post("/update-order", (req, res) => {
    const { orderedItems } = req.body; // Array of ordered item IDs
    let query = "UPDATE items SET display_order = CASE id ";
    let values = [];
    
    orderedItems.forEach((id, index) => {
        query += `WHEN ? THEN ? `;
        values.push(id, index);
    });

    query += "END WHERE id IN (?)";
    values.push(orderedItems);

    db.query(query, values, (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true });
    });
});

// Update an item
app.put('/items/:id', (req, res) => {
    const itemId = req.params.id;
    const updatedField = req.body; // The updated field will be dynamically passed (e.g., brand, model, etc.)
    // Since you're updating a specific field, we'll use the name of the field dynamically
    const fieldName = Object.keys(updatedField)[0];  // Get the key of the updated field (e.g., brand, model)
    const fieldValue = updatedField[fieldName];      // Get the value of the updated field
  
    const sql = `UPDATE items SET ${fieldName} = ? WHERE id = ?`;
  
    db.query(sql, [fieldValue, itemId], (err, result) => {
      if (err) {
        console.error('Error updating item:', err);
        res.status(500).send('Internal Server Error');
        return;
      }
      res.json({ id: itemId, [fieldName]: fieldValue }); // Return the updated item
    });
});

// Delete an item
app.delete('/items/:id', (req, res) => {
    const itemId = req.params.id;
    db.query('DELETE FROM items WHERE id = ?', [itemId], (err, result) => {
        if (err) {
            console.error('Error deleting item:', err);
            res.status(500).send(err);
            return;
        }
        res.sendStatus(200);
    });
});

// Stock Entry:---------

// Fetch all stock entry invoices
app.get('/stockentinvs', (req, res) => {
    const sql = 'SELECT id, DATE_FORMAT(nowDate, "%Y-%m-%d, %H:%i:%s") AS nowDate, items, invStatus, sku FROM stockentinvs';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching stock entry invoices:', err);
            return res.status(500).json({ error: 'Database error'});
        }
        res.json(result)
    })
});

// Fetch a stock entry invoice by ID
app.get('/stockentinvs/:id', (req, res) => {
    const invoiceId = req.params.id;
    const sql = 'SELECT * FROM stockentinvs WHERE id = ?';
    db.query(sql, [invoiceId], (err, result) => {
        if (err) {
            console.error('Error fetching the stock entry invoice')
            return res.status(500).json({ error: 'Database error'});
        }
        res.json(result[0]);
    })
});

// Add a new stock entry invoice
app.post('/stockentinvs', (req, res) => {
    const {items, invStatus, sku, remark} = req.body;
    const sql = 'INSERT INTO stockentinvs (items, invStatus, sku, remark) VALUES (?, ?, ?, ?)';
    db.query(sql, [items, invStatus, sku, remark], (err, result) => {
        if (err) {
            console.error('Error adding stock entry invoices:', err);
            res.status(500).json({ message: 'Error adding stock entry invoice' });
            return;
        }
        res.json(result);
    })
});

// Update the stock entry with multiple fields
app.put('/stockentinvs/:id', (req, res) => {
    const invoiceId = req.params.id;
    const updatedFields = req.body;

    // Generate dynamic SQL query
    const fieldNames = Object.keys(updatedFields);
    const fieldValues = Object.values(updatedFields);

    // Construct the SET clause dynamically
    const setClause = fieldNames.map(field => `${field} = ?`).join(', ');
    const sql = `UPDATE stockentinvs SET ${setClause} WHERE id = ?`;

    // Execute the query
    db.query(sql, [...fieldValues, invoiceId], (err, result) => {
        if (err) {
            console.error('Error updating the stock entry invoice:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.json(result);
    });
});

// Delete a stock entry invoice
app.delete('/stockentinvs/:id', (req, res) => {
    const invoiceId = req.params.id;
    db.query(`DELETE FROM stockentinvs WHERE id = ${invoiceId}`, (err, result) => {
        if (err) {
            console.error('Error deleting a stock entry invoice');
            return res.status(500).send(err)
        }
        res.status(200).json({ message: 'Invoice deleted successfully' }); // Send JSON response
    })
});

// POS:-----------

// Add a pos invoice
app.post('/posinvoices', (req, res) => {
    const {newDate, items, customerId, delFee, deliveryId, workerId, orders, total, discount, netTotal, invStatus, totalQuantity, note, priceLevel, computerName, itemIds } = req.body;
    const sql = `
    INSERT INTO posinvoices (
        newDate, items, customerId, delFee, deliveryId, workerId, orders, total, discount, netTotal,
        invStatus, totalQuantity, note, priceLevel, computerName, itemIds
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [newDate, items, customerId, delFee, deliveryId, workerId, orders, total, discount, netTotal, invStatus, totalQuantity, note, priceLevel, computerName, itemIds], (err, result) => {
        if (err) {
            console.error('Error adding the pos invoice:', err);
            return res.status(500).send(err);
        }
        res.json(result);
    })
});

// Invoices:--------

// Fetch all pos invoices:
app.get('/posinvoices', (req, res) => {
    const sql = 'SELECT posinvoices.id, DATE_FORMAT(posinvoices.newDate, "%Y-%m-%d, %H:%i:%s") AS newDate, posinvoices.items, customers.name AS customer_name, deliveries.name AS delivery_name, posinvoices.delFee, posinvoices.total, posinvoices.discount, posinvoices.netTotal, posinvoices.note, posinvoices.invStatus, posinvoices.totalQuantity, posinvoices.customerId, posinvoices.deliveryId, posinvoices.workerId, posinvoices.orders, posinvoices.priceLevel, posinvoices.computerName FROM posinvoices JOIN customers ON customers.id = posinvoices.customerId JOIN deliveries ON deliveries.id = posinvoices.deliveryId JOIN workers ON workers.id = posinvoices.workerId';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching pos invoices');
            return res.status(500).send(err);
        }
        res.json(result);
    })
});

// Fetch all posinvoices with filters
app.get('/posinvoicesFilter', (req, res) => {
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const priceSelectVal = req.query.priceSelectVal === 'All' ? '%%' : `%${req.query.priceSelectVal}%`;
    const deliverySelectVal =
    req.query.deliverySelectVal === 'Both' ? '%%'
    : req.query.deliverySelectVal === 'Delivery' ? 'No Delivery'
    : `%${req.query.deliverySelectVal}%`;
    const checkIcon = req.query.checkIcon.includes('fa-circle-check') ? '%Paid%' : '%Canceled%';
    const search = req.query.search.split(',');
    const searchVal = `%${req.query.searchVal || ''}%`;
    const customerName = req.query.customer === '' ? '%%' : `%${req.query.customer}%`;
    const deliveryName = req.query.delivery === '' ? '%%' : `%${req.query.delivery}%`;
    const workerName = req.query.worker === '' ? '%%' : `%${req.query.worker}%`;
    const limit = Number(req.query.limit) || 50;
    let sql = `
        SELECT posinvoices.id, 
            DATE_FORMAT(posinvoices.newDate, "%Y-%m-%d, %H:%i:%s") AS newDate, 
            posinvoices.items, 
            customers.name AS customer_name, 
            deliveries.name AS delivery_name,
            workers.name AS worker_name,
            posinvoices.total, 
            posinvoices.discount,
            posinvoices.netTotal,
            posinvoices.note, 
            posinvoices.invStatus,
            posinvoices.totalQuantity, 
            posinvoices.customerId,
            posinvoices.delFee,
            posinvoices.deliveryId,
            posinvoices.workerId,
            posinvoices.orders,
            posinvoices.priceLevel,
            posinvoices.computerName,
            posinvoices.itemIds
        FROM posinvoices 
        JOIN customers ON customers.id = posinvoices.customerId
        LEFT JOIN deliveries ON deliveries.id = posinvoices.deliveryId
        LEFT JOIN workers ON workers.id = posinvoices.workerId
        WHERE DATE(posinvoices.newDate) BETWEEN ? AND ? 
          AND posinvoices.priceLevel LIKE ?
          AND posinvoices.invStatus LIKE ?
    `;
    const params = [startDate, endDate, priceSelectVal, checkIcon];
    // 🔄 Add itemIds filter with forEach
    if (search[0] !== '') {
        sql += ' AND (';
        search.forEach((id, index) => {
            if (index > 0) sql += ' OR ';
            sql += 'JSON_CONTAINS(itemIds, ?)';
            params.push(`"${id}"`);
        });
        sql += ' OR posinvoices.note LIKE ?';
        params.push(searchVal);

        sql += ' OR posinvoices.id LIKE ?';
        params.push(searchVal);

        sql += ' OR customers.name LIKE ?';
        params.push(searchVal);

        sql += ' OR deliveries.name LIKE ?';
        params.push(searchVal);

        sql += ' OR posinvoices.computerName LIKE ?';
        params.push(searchVal);

        sql += ' OR workers.name LIKE ?';
        params.push(searchVal);

        sql += ')';
    }
    // ✅ Add customer name filter
    sql += ` AND customers.name LIKE ?`;
    params.push(customerName);

    sql += ` AND deliveries.name LIKE ?`;
    params.push(deliveryName);

    sql += ` AND workers.name LIKE ?`;
    params.push(workerName);

    if (deliverySelectVal !== 'No Delivery') {
        sql += ` AND deliveries.name LIKE ?`;
        params.push(deliverySelectVal);
    } else {
        sql += ` AND deliveries.name != ?`;
        params.push(deliverySelectVal);
    }

    sql += ` ORDER BY posinvoices.newDate DESC, posinvoices.id DESC LIMIT ?`;

    params.push(limit);
    db.query(sql, params, (err, result) => {
        if (err) {
            console.error('Error fetching pos invoices');
            return res.status(500).send(err);
        }
        res.json(result);
    });
});

// Fetch a pos invoice by ID
app.get('/posinvoices/:id', (req, res) => {
    const invoiceId = Number(req.params.id);
    const sql = `
        SELECT posinvoices.id, 
               DATE_FORMAT(posinvoices.newDate, "%Y-%m-%d, %H:%i:%s") AS newDate, 
               posinvoices.items, 
               customers.name AS customer_name, 
               deliveries.name AS delivery_name, 
               posinvoices.total, 
               posinvoices.discount, 
               posinvoices.netTotal, 
               posinvoices.note, 
               posinvoices.invStatus, 
               posinvoices.totalQuantity, 
               posinvoices.customerId, 
               posinvoices.deliveryId,
               posinvoices.workerId,
               posinvoices.orders,
               posinvoices.priceLevel,
               posinvoices.computerName
        FROM posinvoices 
        JOIN customers ON customers.id = posinvoices.customerId 
        JOIN deliveries ON deliveries.id = posinvoices.deliveryId
        JOIN workers ON workers.id = posinvoices.workerId
        WHERE posinvoices.id = ?`;

    db.query(sql, [invoiceId], (err, result) => {
        if (err) {
            console.error('Error fetching the invoice:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (result.length === 0) {
            // No invoice found
            return res.status(404).json({ error: 'Invoice not found' });
        }
        res.json(result[0]);
    });
});

// Update a pos invoice
app.put('/posinvoices/:id', (req, res) => {
    const invoiceId = req.params.id;
    const updatedField = req.body;
    const fieldName = Object.keys(updatedField)[0];
    const fieldValue = updatedField[fieldName];
    const sql = `UPDATE posinvoices SET ${fieldName} = ? WHERE id = ?`
    db.query(sql, [fieldValue, invoiceId], (err, result) => {
        if (err) {
            console.error('Error updating the pos invoice');
            return res.status(500).send('Internal Server Error');
        }
        res.json(result);
    })
});

// Delete an invoice
app.delete('/posinvoices/:id', (req, res) => {
    const sql = 'DELETE FROM posinvoices WHERE id = ?';
    const invoiceId = req.params.id;
    db.query(sql, [invoiceId], (err, result) => {
        if (err) {
            console.error('Error delete the invoice');
            return res.status(500).send(err)
        };
        res.json(result[0]);
    })
});

// Groups:------------

// Fetch all brands
app.get('/brand', (req, res) => {
    const sql = 'SELECT * FROM brand';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching all brands:', err); // Logs actual error for debugging
            return res.status(500).json({ message: 'Failed to fetch brands' }); // Sends a user-friendly error message
        }
        res.json(result);
    })
})

// Add a brand
app.post('/brand', (req, res) => {
    const sql = `INSERT INTO brand (name) VALUES (?)`;
    const { name } = req.body;
    db.query(sql, [name], (err, result) => {
        if (err) {
            console.error('Error inserting the brand');
            return res.status(500);
        }
        res.json(result);
    })
})

// Delete a brand
app.delete('/brand/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM brand WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting brand:', err);
            return res.status(500).json({ message: 'Failed to delete brand' });
        }
        res.json(result);
    })
})

// Update a brand
app.put('/brand/:id', (req, res) => {
    const id = req.params.id;
    const updatedField = req.body;
    const fieldName = Object.keys(updatedField)[0];
    const fieldValue = updatedField[fieldName];
    const sql = `UPDATE brand set ${fieldName} = ? WHERE id = ?`
    db.query(sql, [fieldValue, id], (err, result) => {
        res.json(result);
    });
})

// Fetch all models
app.get('/model', (req, res) => {
    const search = `%${req.query.search || ''}%`
    const limit = Number(req.query.limit || 1000000);
    const sql = 'SELECT * FROM model WHERE name LIKE ? ORDER BY id DESC LIMIT ?';
    db.query(sql, [search, limit], (err, result) => {
        if (err) {
            console.error('Error fetching all models:', err); // Logs actual error for debugging
            return res.status(500).json({ message: 'Failed to fetch models' }); // Sends a user-friendly error message
        }
        res.json(result);
    })
})

// Add a model
app.post('/model', (req, res) => {
    const sql = `INSERT INTO model (name) VALUES (?)`;
    const { model } = req.body;
    db.query(sql, [model], (err, result) => {

        if (err) {
            console.error('Error inserting the model');
            return res.status(500);
        }
        res.json(result);
    })
})

// Delete a model
app.delete('/model/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM model WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting model:', err);
            return res.status(500).json({ message: 'Failed to delete model' });
        }
        res.json(result);
    })
})

// Update a model
app.put('/model/:id', (req, res) => {
    const id = req.params.id;
    const updatedField = req.body;
    const fieldName = Object.keys(updatedField)[0];
    const fieldValue = updatedField[fieldName];
    const sql = `UPDATE model set ${fieldName} = ? WHERE id = ?`
    db.query(sql, [fieldValue, id], (err, result) => {
        res.json(result);
    });
})

// Fetch all category
app.get('/category', (req, res) => {
    const sql = 'SELECT * FROM category';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching all categories:', err); // Logs actual error for debugging
            return res.status(500).json({ message: 'Failed to fetch categories' }); // Sends a user-friendly error message
        }
        res.json(result);
    })
})

// Add a category
app.post('/category', (req, res) => {
    const sql = `INSERT INTO category (name) VALUES (?)`;
    const { category } = req.body;
    db.query(sql, [category], (err, result) => {
        if (err) {
            console.error('Error inserting the category');
            return res.status(500);
        }
        res.json(result);
    })
})

// Delete a category
app.delete('/category/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM category WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting category:', err);
            return res.status(500).json({ message: 'Failed to delete category' });
        }
        res.json(result);
    })
})

// Update a category
app.put('/category/:id', (req, res) => {
    const id = req.params.id;
    const updatedField = req.body;
    const fieldName = Object.keys(updatedField)[0];
    const fieldValue = updatedField[fieldName];
    const sql = `UPDATE category set ${fieldName} = ? WHERE id = ?`
    db.query(sql, [fieldValue, id], (err, result) => {
        if (err) {
            console.error('Error updating the color');
            return res.status(500).send('Internal Server Error');
        }
        res.json(result);
    });
})

// Fetch all quality
app.get('/quality', (req, res) => {
    const sql = 'SELECT * FROM quality';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching all quality:', err); // Logs actual error for debugging
            return res.status(500).json({ message: 'Failed to fetch quality' }); // Sends a user-friendly error message
        }
        res.json(result);
    })
})

// Add a quality
app.post('/quality', (req, res) => {
    const sql = `INSERT INTO quality (name) VALUES (?)`;
    const { quality } = req.body;
    db.query(sql, [quality], (err, result) => {
        if (err) {
            console.error('Error inserting the quality');
            return res.status(500);
        }
        res.json(result);
    })
})

// Delete a quality
app.delete('/quality/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM quality WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting quality:', err);
            return res.status(500).json({ message: 'Failed to delete quality' });
        }
        res.json(result);
    })
})

// Update a quality
app.put('/quality/:id', (req, res) => {
    const id = req.params.id;
    const updatedField = req.body;
    const fieldName = Object.keys(updatedField)[0];
    const fieldValue = updatedField[fieldName];
    const sql = `UPDATE quality set ${fieldName} = ? WHERE id = ?`
    db.query(sql, [fieldValue, id], (err, result) => {
        res.json(result);
    });
})

// Customers:--------------

// Fetching all customers
app.get('/customers', (req, res) => {
    const sql = 'SELECT id, DATE_FORMAT(dateTime, "%Y-%m-%d, %H:%i:%s") AS dateTime, name, phoneNo, delFee, address, remark, priceLevel FROM customers';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching all customers:', err); // Logs actual error for debugging
            return res.status(500).json({ message: 'Failed to fetch customers' }); // Sends a user-friendly error message
        }
        res.json(result)
    })
})

// Fetch a customer by Id
app.get('/customers/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM customers WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error fetching the customer')
            return res.status(500).json({ error: 'Database error'});
        }
        res.json(result[0]);
    })
})

// Add a customer
app.post('/customers', (req, res) => {
    const { name, phoneNo, address, remark, priceLevel } = req.body;
    const sql = 'INSERT INTO customers (name, phoneNo, address, remark, priceLevel) VALUES ( ?, ?, ?, ?, ?)';
    db.query(sql, [name, phoneNo, address, remark, priceLevel], (err, result) => {
        if (err) {
            console.error('Error inserting the customer');
            return res.status(500);
        }
        res.json(result);
    })
})

// Update a customer
app.put('/customers/:id', (req, res) => {
    const id = req.params.id;
    const updatedField = req.body;
    const fieldName = Object.keys(updatedField)[0];
    const fieldValue = updatedField[fieldName];
    const sql = `UPDATE customers set ${fieldName} = ? WHERE id = ?`
    db.query(sql, [fieldValue, id], (err, result) => {
        res.json(result);
    });
})

// Delete a customer
app.delete('/customers/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM customers WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting the customer:', err);
            return res.status(500).json({ message: 'Failed to delete customer' });
        }
        res.json(result);
    })
})

//Loan:------------

// Fetch all loans
app.get('/loans', (req, res) => {
    const sql = 'SELECT loans.id, loans.amount, loans.invoiceNum, DATE_FORMAT(posinvoices.newDate, "%W, %Y-%m-%d %h:%i:%s %p") AS posNowDate, DATE_FORMAT(loans.nowDate, "%W, %Y-%m-%d %h:%i:%s %p") AS loanNowDate, loans.note, loans.customer_id FROM loans LEFT JOIN posinvoices ON loans.invoiceNum = posinvoices.id;';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching all loans:', err); // Logs actual error for debugging
            return res.status(500).json({ message: 'Failed to fetch laons' }); // Sends a user-friendly error message
        }
        res.json(result)
    })
})

// Fetch all loans by a specific customer id
app.get('/loans/:id', (req, res) => {
    const sql = 'SELECT loans.id, loans.amount, loans.invoiceNum, DATE_FORMAT(posinvoices.newDate, "%W, %Y-%m-%d %h:%i:%s %p") AS posNowDate, DATE_FORMAT(loans.nowDate, "%W, %Y-%m-%d %h:%i:%s %p") AS loanNowDate, loans.note, loans.customer_id FROM loans LEFT JOIN posinvoices ON loans.invoiceNum = posinvoices.id WHERE loans.customer_id = ?;';
    const id = req.params.id;
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error fetching all loans:', err); // Logs actual error for debugging
            return res.status(500).json({ message: 'Failed to fetch laons' }); // Sends a user-friendly error message
        }
        res.json(result)
    })
})

// Fetch one loan by its id
app.get('/oneloan/:invoiceNum', (req, res) => {
    const sql = 'SELECT id, amount, invoiceNum, DATE_FORMAT(nowDate, "%Y-%m-%d, %H:%i:%s") AS nowDate, note, customer_id FROM loans WHERE invoiceNum = ?';
    const id = req.params.invoiceNum;
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error fetching all loans:', err); // Logs actual error for debugging
            return res.status(500).json({ message: 'Failed to fetch laons' }); // Sends a user-friendly error message
        }
        res.json(result[0]);
    })
})

// Add a loan to a specific customer by id
app.post('/loans', (req, res) => {
    const sql = 'INSERT INTO loans (amount, invoiceNum, note, customer_id) VALUES (?, ?, ?, ?)';
    const { amount, invoiceNum, note, customer_id} = req.body;
    db.query(sql, [amount, invoiceNum, note, customer_id], (err, result) => {
        if (err) {
            console.error('Error inserting the loan');
            return res.status(500);
        }
        res.json(result)
    }) 
})

app.put('/loans/:id', (req, res) => {
    const loanId = req.params.id;
    const updatedFields = req.body;
    // Validate that the request body contains fields to update
    if (Object.keys(updatedFields).length === 0) {
        return res.status(400).send('No fields provided for update');
    }
    // Construct the SET clause dynamically
    const setClause = Object.keys(updatedFields)
        .map(key => `${key} = ?`) // Create "key = ?" for each field
        .join(', '); // Join them with commas
    // Extract the values to be updated
    const values = Object.values(updatedFields);
    // Add the loan ID to the end of the values array for the WHERE clause
    values.push(loanId);
    // Construct the SQL query
    const sql = `UPDATE loans SET ${setClause} WHERE id = ?`;
    // Execute the query
    db.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error updating the loan:', err);
            return res.status(500).send('Internal Server Error');
        }
        // Check if any rows were affected
        if (result.affectedRows === 0) {
            return res.status(404).send('Loan not found');
        }
        // Return a success response
        res.json({ message: 'Loan updated successfully', result });
    });
});

// Delete a loan by the loan id
app.delete('/loans/:id', (req, res) => {
    const loanId = req.params.id;
    const sql = 'DELETE FROM loans WHERE id = ?';
    db.query(sql, [loanId], (err, result) => {
        if (err) {
            console.error('Error deleting the loan:', err);
            return res.status(500).json({ message: 'Failed to delete loan' });
        }
        res.json(result);
    })
})

// Delete all loans from a specific customer
app.delete('/totalLoans/:id', (req, res) => {
    const customerId = req.params.id;
    const sql = 'DELETE FROM loans WHERE customer_id = ?';
    db.query(sql, [customerId], (err, result) => {
        if (err) {
            console.error('Error deleting the customer loans:', err);
            return res.status(500).json({ message: 'Failed to delete loans' });
        }
        res.json(result);
    })
})

// API route to export items to Excel
app.post("/export-excel", async (req, res) => {
    try {
      const items = req.body.items; // Get the data sent from the frontend
  
      // Create a new workbook and worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Stock Items");
  
      // Add headers with styling
      const headers = [
        "Id", "SKU", "Box ID", "Brand", "Model",
        "Category", "Quality", "Quantity", "Buy Price", "Price Four"
      ];
      
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "1da355" }, // Green background
        };
        cell.font = { bold: true, color: { argb: "FFFFFF" }, size: 13}; // White text
        cell.alignment = { horizontal: "center" }; // Center text horizontally
      });

      worksheet.getColumn(1).width = 10; // Increase width of the Model column
      worksheet.getColumn(2).width = 15;
      worksheet.getColumn(3).width = 17;
      worksheet.getColumn(4).width = 25;
      worksheet.getColumn(5).width = 17;
      worksheet.getColumn(6).width = 18;
      worksheet.getColumn(7).width = 12;
      worksheet.getColumn(8).width = 15;
      worksheet.getColumn(9).width = 15;
      // Add rows dynamically from the data received from frontend
      items.forEach((item, index) => {
        const row = worksheet.addRow([
          item[0],
          item[1] || "",
          item[2],
          item[3],
          item[4],
          item[5],
          item[6],
          item[7],
          Number(item[8] * 1000).toLocaleString(),
          Number(item[9] * 1000).toLocaleString(),
        ]);
  
        // Apply bold and center alignment to all cells in this row
        row.eachCell((cell) => {
          cell.font = { bold: true , size: 13}; // Apply bold to every cell in the row
          cell.alignment = { horizontal: "center" }; // Center text horizontally
        });
      });
  
      // Send Excel file as a response
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=items.xlsx");
  
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Error exporting Excel:", error);
      res.status(500).send("Error generating Excel file");
    }
});

// deliveries:--------------

// Fetching all deliveries
app.get('/deliveries', (req, res) => {
    const sql = 'SELECT id, DATE_FORMAT(dateTime, "%Y-%m-%d, %H:%i:%s") AS dateTime, name, phoneNo, address FROM deliveries';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching all deliveries:', err); // Logs actual error for debugging
            return res.status(500).json({ message: 'Failed to fetch deliveries' }); // Sends a user-friendly error message
        }
        res.json(result)
    })
})

// Fetch a delivery by Id
app.get('/deliveries/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM deliveries WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error fetching the delivery')
            return res.status(500).json({ error: 'Database error'});
        }
        res.json(result[0]);
    })
})

// Add a delivery
app.post('/deliveries', (req, res) => {
    const { name, phoneNo, address } = req.body;
    const sql = 'INSERT INTO deliveries (name, phoneNo, address) VALUES (?, ?, ?)';
    db.query(sql, [name, phoneNo, address], (err, result) => {
        if (err) {
            console.error('Error inserting the customer');
            return res.status(500);
        }
        res.json(result);
    })
})

// Update a delivery
app.put('/deliveries/:id', (req, res) => {
    const id = req.params.id;
    const updatedField = req.body;
    const fieldName = Object.keys(updatedField)[0];
    const fieldValue = updatedField[fieldName];
    const sql = `UPDATE deliveries set ${fieldName} = ? WHERE id = ?`
    db.query(sql, [fieldValue, id], (err, result) => {
        res.json(result);
    });
})

// Delete a delivery
app.delete('/deliveries/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM deliveries WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting the customer:', err);
            return res.status(500).json({ message: 'Failed to delete customer' });
        }
        res.json(result);
    })
})

// Workers:--------------

// Fetching all workers
app.get('/workers', (req, res) => {
    const sql = 'SELECT id, DATE_FORMAT(dateTime, "%Y-%m-%d, %H:%i:%s") AS dateTime, name, phoneNo, address FROM workers';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching all workers:', err); // Logs actual error for debugging
            return res.status(500).json({ message: 'Failed to fetch workers' }); // Sends a user-friendly error message
        }
        res.json(result)
    })
})

// Fetch a worker by Id
app.get('/workers/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'SELECT * FROM workers WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error fetching the worker')
            return res.status(500).json({ error: 'Database error'});
        }
        res.json(result[0]);
    })
})

// Add a worker
app.post('/workers', (req, res) => {
    const { name, phoneNo, address } = req.body;
    const sql = 'INSERT INTO workers (name, phoneNo, address) VALUES (?, ?, ?)';
    db.query(sql, [name, phoneNo, address], (err, result) => {
        if (err) {
            console.error('Error inserting the worker');
            return res.status(500);
        }
        res.json(result);
    })
})

// Update a worker
app.put('/workers/:id', (req, res) => {
    const id = req.params.id;
    const updatedField = req.body;
    const fieldName = Object.keys(updatedField)[0];
    const fieldValue = updatedField[fieldName];
    const sql = `UPDATE workers set ${fieldName} = ? WHERE id = ?`
    db.query(sql, [fieldValue, id], (err, result) => {
        res.json(result);
    });
})

// Delete a worker
app.delete('/workers/:id', (req, res) => {
    const id = req.params.id;
    const sql = 'DELETE FROM workers WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting the worker:', err);
            return res.status(500).json({ message: 'Failed to delete worker' });
        }
        res.json(result);
    })
})

app.listen(process.env.PORT, () => {
    console.log(`Server running...`);
});