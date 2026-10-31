<?php
/**
 * api/config.example.php
 * ----------------------
 * Template konfigurasi untuk Smart Finance Assistant.
 * File ini AMAN untuk diunggah ke GitHub — tidak mengandung API Key asli.
 *
 * CARA PENGGUNAAN:
 * 1. Salin file ini menjadi config.php:
 *      cp api/config.example.php api/config.php
 * 2. Buka api/config.php
 * 3. Ganti 'GANTI_DENGAN_API_KEY_ANDA' dengan API Key OpenAI Anda
 * 4. Simpan file
 *
 * Dapatkan API Key di: https://platform.openai.com/api-keys
 *
 * PENTING:
 * - File config.php sudah masuk .gitignore — tidak akan ter-upload ke GitHub
 * - Jangan pernah menaruh API Key asli di file ini (config.example.php)
 */

// =====================================================
// >> ISI API KEY ANDA DI SINI di file config.php
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
