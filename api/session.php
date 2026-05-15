<?php
// ─────────────────────────────────────────────────────────────
// api/session.php — Create / close orthostatic test sessions
// ─────────────────────────────────────────────────────────────
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

require_once __DIR__ . '/../config.php';

// ── DB connection ──────────────────────────────────────────
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

// ── POST /api/session — Start a new session ────────────────
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);

    $participant_id = trim($body['participant_id'] ?? '');
    $protocol       = trim($body['protocol'] ?? 'standard'); // standard | extended
    $operator       = trim($body['operator']  ?? 'unknown');

    if (empty($participant_id)) {
        http_response_code(400);
        echo json_encode(['error' => 'participant_id is required']);
        exit;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO sessions (participant_id, protocol, operator, started_at, status)
         VALUES (?, ?, ?, NOW(), "active")'
    );
    $stmt->execute([$participant_id, $protocol, $operator]);
    $session_id = $pdo->lastInsertId();

    echo json_encode([
        'session_id'     => $session_id,
        'participant_id' => $participant_id,
        'protocol'       => $protocol,
        'started_at'     => date('c'),
        'status'         => 'active',
    ]);
    exit;
}

// ── GET /api/session?session_id=X — Get session info ───────
if ($method === 'GET' && isset($_GET['session_id'])) {
    $session_id = (int) $_GET['session_id'];

    $stmt = $pdo->prepare('SELECT * FROM sessions WHERE id = ?');
    $stmt->execute([$session_id]);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$session) {
        http_response_code(404);
        echo json_encode(['error' => 'Session not found']);
        exit;
    }

    echo json_encode($session);
    exit;
}

// ── DELETE /api/session?session_id=X — Close session ───────
if ($method === 'DELETE' && isset($_GET['session_id'])) {
    $session_id = (int) $_GET['session_id'];

    $stmt = $pdo->prepare(
        'UPDATE sessions SET status = "complete", ended_at = NOW() WHERE id = ?'
    );
    $stmt->execute([$session_id]);

    echo json_encode([
        'session_id' => $session_id,
        'status'     => 'complete',
        'ended_at'   => date('c'),
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
