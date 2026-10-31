<?php
/**
 * api/chat.php
 * ------------
 * Backend proxy untuk Smart Finance Assistant.
 *
 * Menerima POST request dari front-end (script.js),
 * meneruskannya ke OpenAI API, dan mengembalikan respons.
 *
 * API Key OpenAI TIDAK pernah dikirim ke browser.
 * Semua komunikasi dengan OpenAI terjadi di sisi server.
 */

// -------------------------------------------------------
// 1. Muat konfigurasi
// -------------------------------------------------------
require_once __DIR__ . '/config.php';

// -------------------------------------------------------
// 1a. Validasi API Key — gagal cepat sebelum memproses request
// -------------------------------------------------------
// Daftar nilai yang dianggap "belum diisi"
$_placeholders = [
    '',
    'GANTI_DENGAN_API_KEY_ANDA',
    'sk-YOUR_OPENAI_API_KEY_HERE',
];
$_keyValue = defined('OPENAI_API_KEY') ? OPENAI_API_KEY : '';

if (in_array(trim($_keyValue), $_placeholders, true) || str_starts_with($_keyValue, 'GANTI_')) {
    header('Content-Type: application/json; charset=UTF-8');
    http_response_code(400);
    echo json_encode([
        'error' =>
            "⚙️ API Key belum diisi.\n\n" .
            "Buka file  api/config.php  lalu ganti:\n" .
            "  define('OPENAI_API_KEY', 'GANTI_DENGAN_API_KEY_ANDA');\n\n" .
            "menjadi:\n" .
            "  define('OPENAI_API_KEY', 'sk-proj-xxx...');\n\n" .
            "Dapatkan key di: https://platform.openai.com/api-keys",
    ]);
    exit;
}
unset($_placeholders, $_keyValue);

// -------------------------------------------------------
// 2. CORS Headers
// -------------------------------------------------------
header('Access-Control-Allow-Origin: ' . ALLOWED_ORIGIN);
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=UTF-8');

// Tangani preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// -------------------------------------------------------
// 3. Validasi metode request
// -------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metode tidak diizinkan. Gunakan POST.']);
    exit;
}

// -------------------------------------------------------
// 4. Baca & validasi payload dari front-end
// -------------------------------------------------------
$rawBody = file_get_contents('php://input');
$body    = json_decode($rawBody, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['error' => 'Request body bukan JSON yang valid.']);
    exit;
}

$systemPrompt = isset($body['systemPrompt']) ? trim($body['systemPrompt']) : '';
$messages     = isset($body['messages'])     ? $body['messages']           : [];

if (empty($systemPrompt)) {
    http_response_code(400);
    echo json_encode(['error' => 'systemPrompt tidak boleh kosong.']);
    exit;
}

if (!is_array($messages)) {
    http_response_code(400);
    echo json_encode(['error' => 'messages harus berupa array.']);
    exit;
}

// -------------------------------------------------------
// 5. Sanitasi messages (cegah injection)
//    Hanya izinkan role 'user' dan 'assistant', serta
//    batasi panjang tiap pesan.
// -------------------------------------------------------
$allowedRoles    = ['user', 'assistant'];
$maxContentLen   = 4000; // karakter per pesan
$sanitizedMessages = [];

foreach ($messages as $msg) {
    if (!isset($msg['role'], $msg['content'])) continue;
    if (!in_array($msg['role'], $allowedRoles, true)) continue;
    $content = substr(trim((string) $msg['content']), 0, $maxContentLen);
    if ($content === '') continue;
    $sanitizedMessages[] = ['role' => $msg['role'], 'content' => $content];
}

// Batasi histori ke 20 pesan terakhir untuk menghindari token overflow
if (count($sanitizedMessages) > 20) {
    $sanitizedMessages = array_slice($sanitizedMessages, -20);
}

// -------------------------------------------------------
// 6. Susun payload untuk OpenAI Chat Completions API
// -------------------------------------------------------
$openaiMessages = array_merge(
    [['role' => 'system', 'content' => $systemPrompt]],
    $sanitizedMessages
);

$openaiPayload = [
    'model'       => OPENAI_MODEL,
    'messages'    => $openaiMessages,
    'max_tokens'  => OPENAI_MAX_TOKENS,
    'temperature' => OPENAI_TEMPERATURE,
];

// -------------------------------------------------------
// 7. Kirim request ke OpenAI API menggunakan cURL
// -------------------------------------------------------
$ch = curl_init('https://api.openai.com/v1/chat/completions');

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . OPENAI_API_KEY,
    ],
    CURLOPT_POSTFIELDS     => json_encode($openaiPayload),
    CURLOPT_TIMEOUT        => 60,      // Batas waktu 60 detik
    CURLOPT_SSL_VERIFYPEER => true,    // Selalu verifikasi SSL
]);

$response   = curl_exec($ch);
$curlError  = curl_error($ch);
$httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// -------------------------------------------------------
// 8. Tangani error cURL (koneksi gagal)
// -------------------------------------------------------
if ($curlError) {
    http_response_code(502);
    echo json_encode(['error' => 'Gagal menghubungi OpenAI API: ' . $curlError]);
    exit;
}

// -------------------------------------------------------
// 9. Tangani error dari OpenAI API
// -------------------------------------------------------
$openaiData = json_decode($response, true);

if ($httpCode !== 200) {
    // Ambil pesan asli dari OpenAI (untuk dicatat di server log — tidak dikirim ke browser)
    $openaiErrorMsg = isset($openaiData['error']['message'])
        ? $openaiData['error']['message']
        : 'Tidak ada pesan error dari OpenAI.';
    $openaiErrorCode = isset($openaiData['error']['code'])
        ? $openaiData['error']['code']
        : '';

    // Catat detail error di server log (hanya bisa dilihat developer, tidak oleh pengguna)
    error_log("[SFT AI] OpenAI HTTP {$httpCode} | code: {$openaiErrorCode} | msg: {$openaiErrorMsg}");

    // Pesan ramah berdasarkan HTTP status — tidak membocorkan detail teknis ke browser
    $friendlyErrors = [
        401 => '❌ API Key tidak valid atau sudah kedaluwarsa (HTTP 401).' . "\n\n"
             . "Langkah perbaikan:\n"
             . "1. Buka file api/config.php\n"
             . "2. Ganti nilai OPENAI_API_KEY dengan API Key yang valid\n"
             . "   Format: sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx\n"
             . "3. Dapatkan API Key baru di: https://platform.openai.com/api-keys\n"
             . "4. Pastikan akun OpenAI memiliki kredit/billing yang aktif",
        403 => '❌ Akses ditolak oleh OpenAI (HTTP 403). Akun mungkin tidak memiliki akses ke model yang dipilih.',
        429 => '❌ Batas request API tercapai (HTTP 429). Tunggu beberapa menit lalu coba lagi, atau periksa kuota penggunaan di platform.openai.com.',
        500 => '❌ Server OpenAI mengalami gangguan internal (HTTP 500). Coba lagi beberapa saat.',
        503 => '❌ Layanan OpenAI sedang tidak tersedia (HTTP 503). Coba lagi nanti.',
    ];

    $displayMessage = $friendlyErrors[$httpCode] ?? "❌ OpenAI mengembalikan error HTTP {$httpCode}. Periksa log server untuk detail.";

    http_response_code($httpCode >= 500 ? 502 : $httpCode);
    echo json_encode(['error' => $displayMessage]);
    exit;
}

// -------------------------------------------------------
// 10. Ekstrak dan kembalikan respons AI
// -------------------------------------------------------
if (
    !isset($openaiData['choices'][0]['message']['content']) ||
    $openaiData['choices'][0]['message']['content'] === ''
) {
    http_response_code(502);
    echo json_encode(['error' => 'Respons AI tidak dapat dibaca. Coba lagi.']);
    exit;
}

$aiReply = trim($openaiData['choices'][0]['message']['content']);

// Kembalikan hanya teks respons ke front-end
echo json_encode(['reply' => $aiReply]);
