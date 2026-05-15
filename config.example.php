<?php
// ─────────────────────────────────────────────────────────────
// Polar HRV Orthostatic App — Configuration Template
// Copy this file to config.php and fill in your values.
// NEVER commit config.php to version control.
// ─────────────────────────────────────────────────────────────

// Database
define('DB_HOST',     'localhost');
define('DB_NAME',     'polar_hrv');
define('DB_USER',     'your_db_user');
define('DB_PASS',     'your_db_password');
define('DB_CHARSET',  'utf8mb4');

// App
define('APP_ENV',     'development');   // 'development' or 'production'
define('APP_SECRET',  'change-me-to-a-long-random-string');

// Polar BLE device (optional — filter by device name prefix)
define('POLAR_DEVICE_PREFIX', 'Polar H10');

// Session settings
define('SESSION_TIMEOUT_MINUTES', 60);

// Export
define('EXPORT_DIR', __DIR__ . '/exports/');
