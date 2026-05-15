<?php
// ─────────────────────────────────────────────────────────────
// api/report.php — Generate orthostatic session summary report
// ─────────────────────────────────────────────────────────────
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
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

if ($_SERVER['REQUEST_METHOD'] !== 'GET' || empty($_GET['session_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'GET ?session_id=X required']);
    exit;
}

$session_id = (int) $_GET['session_id'];

// ── Fetch session ───────────────────────────────────────────
$stmt = $pdo->prepare('SELECT * FROM sessions WHERE id = ?');
$stmt->execute([$session_id]);
$session = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$session) {
    http_response_code(404);
    echo json_encode(['error' => 'Session not found']);
    exit;
}

// ── Fetch readings per phase ────────────────────────────────
$phases  = ['supine', 'transition', 'standing'];
$metrics = [];

for ($p = 0; $p < count($phases); $p++) {
    $phase = $phases[$p];

    $stmt = $pdo->prepare(
        'SELECT rr_ms, hr_bpm FROM rr_readings
         WHERE session_id = ? AND phase = ?
         ORDER BY recorded_at ASC'
    );
    $stmt->execute([$session_id, $phase]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $rr_arr  = [];
    $hr_arr  = [];
    for ($i = 0; $i < count($rows); $i++) {
        $rr_arr[] = (int)   $rows[$i]['rr_ms'];
        $hr_arr[] = (float) $rows[$i]['hr_bpm'];
    }

    $metrics[$phase] = [
        'n'        => count($rr_arr),
        'hr_mean'  => count($hr_arr) ? round(array_sum($hr_arr) / count($hr_arr), 1) : null,
        'hr_peak'  => count($hr_arr) ? round(max($hr_arr), 1) : null,
        'rmssd'    => computeRMSSD($rr_arr),
        'sdnn'     => computeSDNN($rr_arr),
    ];
}

// ── Orthostatic response scoring ───────────────────────────
$hr_supine   = $metrics['supine']['hr_mean']   ?? 0;
$hr_standing = $metrics['standing']['hr_mean'] ?? 0;
$hr_delta    = round($hr_standing - $hr_supine, 1);

$rmssd_supine   = $metrics['supine']['rmssd']   ?? 0;
$rmssd_standing = $metrics['standing']['rmssd'] ?? 0;

// Clinical thresholds (research reference ranges)
$oi_detected = $hr_delta > 30 || ($rmssd_standing !== null && $rmssd_standing < 10);

$flags = [];
if ($hr_delta > 30) $flags[] = 'HR increase > 30 bpm on standing — possible POTS';
if ($rmssd_standing < 10) $flags[] = 'Very low standing RMSSD — reduced parasympathetic recovery';
if ($hr_delta < 5)  $flags[] = 'Minimal HR response — check device connection';

echo json_encode([
    'session'          => $session,
    'phases'           => $metrics,
    'orthostatic'      => [
        'hr_delta_bpm'        => $hr_delta,
        'rmssd_change_ms'     => round($rmssd_standing - $rmssd_supine, 1),
        'intolerance_detected'=> $oi_detected,
        'flags'               => $flags,
        'result'              => $oi_detected ? 'FLAGGED' : 'Normal',
    ],
    'generated_at' => date('c'),
]);

// ── Helpers ────────────────────────────────────────────────
function computeRMSSD(array $rr): float {
    if (count($rr) < 2) return 0.0;
    $sum = 0.0;
    for ($i = 1; $i < count($rr); $i++) {
        $diff = $rr[$i] - $rr[$i - 1];
        $sum += $diff * $diff;
    }
    return round(sqrt($sum / (count($rr) - 1)), 2);
}

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
