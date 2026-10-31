<?php
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         api/config.php — KONFIGURASI OPENAI API KEY         ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  LANGKAH SATU-SATUNYA YANG PERLU ANDA LAKUKAN:              ║
 * ║                                                              ║
 * ║  Ganti nilai di bawah ini:                                   ║
 * ║    'GANTI_DENGAN_API_KEY_ANDA'                               ║
 * ║  dengan API Key OpenAI milik Anda.                           ║
 * ║                                                              ║
 * ║  Contoh API Key yang valid:                                  ║
 * ║    sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890...          ║
 * ║                                                              ║
 * ║  Cara mendapatkan API Key:                                   ║
 * ║    1. Buka https://platform.openai.com/api-keys              ║
 * ║    2. Login ke akun OpenAI Anda                              ║
 * ║    3. Klik "Create new secret key"                           ║
 * ║    4. Salin key dan tempel di sini                           ║
 * ║    5. Simpan file ini                                        ║
 * ║                                                              ║
 * ║  PENTING: File ini TIDAK boleh diunggah ke GitHub/publik.    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// =====================================================
// >> ISI API KEY ANDA DI SINI (ganti bagian dalam tanda petik)
// =====================================================
define('OPENAI_API_KEY', 'GANTI_DENGAN_API_KEY_ANDA');
// =====================================================

// Model OpenAI yang digunakan.
// Rekomendasi: 'gpt-4o-mini' (murah, cepat, cukup pintar)
// Alternatif : 'gpt-4o' (lebih pintar, lebih mahal)
//              'gpt-3.5-turbo' (paling murah, respons sederhana)
define('OPENAI_MODEL', 'gpt-4o-mini');

// Panjang maksimal respons AI (dalam token, ~750 kata)
define('OPENAI_MAX_TOKENS', 1024);

// Kreativitas AI: 0.0 = sangat konsisten, 1.0 = sangat kreatif
define('OPENAI_TEMPERATURE', 0.7);

// Izin CORS — biarkan '*' untuk pengembangan lokal
// Ganti dengan domain spesifik saat deploy ke server online
define('ALLOWED_ORIGIN', '*');
