<?php
// ─────────────────────────────────────────────────────────────
// api/readings.php — Store and retrieve R-R interval stream
// ─────────────────────────────────────────────────────────────
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../config.php';

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET,
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// ── POST /api/readings — Bulk insert R-R readings ──────────
// Body: { session_id, phase, readings: [{rr_ms, hr_bpm, ts}] }
if ($method === 'POST') {
    $body       = json_decode(file_get_contents('php://input'), true);
    $session_id = (int)   ($body['session_id'] ?? 0);
    $phase      = trim($body['phase'] ?? 'supine'); // supine | transition | standing
    $readings   = $body['readings'] ?? [];

    if (!$session_id || empty($readings)) {
        http_response_code(400);
        echo json_encode(['error' => 'session_id and readings[] are required']);
        exit;
    }

    // Validate session exists and is active
    $chk = $pdo->prepare('SELECT id FROM sessions WHERE id = ? AND status = "active"');
    $chk->execute([$session_id]);
    if (!$chk->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Active session not found']);
        exit;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO rr_readings (session_id, phase, rr_ms, hr_bpm, recorded_at)
         VALUES (?, ?, ?, ?, ?)'
    );

    $inserted = 0;
    for ($i = 0; $i < count($readings); $i++) {
        $r = $readings[$i];
        $stmt->execute([
            $session_id,
            $phase,
            (int)   ($r['rr_ms']  ?? 0),
            (float) ($r['hr_bpm'] ?? 0),
            $r['ts'] ?? date('c'),
        ]);
        $inserted++;
    }

    echo json_encode([
        'session_id' => $session_id,
        'phase'      => $phase,
        'inserted'   => $inserted,
    ]);
    exit;
}

// ── GET /api/readings?session_id=X&phase=supine ────────────
if ($method === 'GET' && isset($_GET['session_id'])) {
    $session_id = (int) $_GET['session_id'];
    $phase      = $_GET['phase'] ?? null;

    $sql    = 'SELECT * FROM rr_readings WHERE session_id = ?';
    $params = [$session_id];

    if ($phase) {
        $sql    .= ' AND phase = ?';
        $params[] = $phase;
    }

    $sql .= ' ORDER BY recorded_at ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Compute basic HRV metrics server-side
    $rr_values = [];
    for ($i = 0; $i < count($rows); $i++) {
        $rr_values[] = (int) $rows[$i]['rr_ms'];
    }

    $rmssd = computeRMSSD($rr_values);
    $sdnn  = computeSDNN($rr_values);

    echo json_encode([
        'session_id' => $session_id,
        'phase'      => $phase ?? 'all',
        'count'      => count($rows),
        'metrics'    => ['rmssd_ms' => $rmssd, 'sdnn_ms' => $sdnn],
        'readings'   => $rows,
    ]);
    exit;
}

// ── Helper: RMSSD ──────────────────────────────────────────
function computeRMSSD(array $rr): float {
    if (count($rr) < 2) return 0.0;
    $sum = 0.0;
    for ($i = 1; $i < count($rr); $i++) {
        $diff = $rr[$i] - $rr[$i - 1];
        $sum += $diff * $diff;
    }
    return round(sqrt($sum / (count($rr) - 1)), 2);
}

// ── Helper: SDNN ───────────────────────────────────────────
function computeSDNN(array $rr): float {
    if (count($rr) < 2) return 0.0;
    $mean = array_sum($rr) / count($rr);
    $sum  = 0.0;
    for ($i = 0; $i < count($rr); $i++) {
        $diff = $rr[$i] - $mean;
        $sum += $diff * $diff;
    }
    return round(sqrt($sum / count($rr)), 2);
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
