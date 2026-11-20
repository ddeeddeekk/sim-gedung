/**
 * ============================================================================
 * SIM-GEDUNG UNSRI - BACKEND GOOGLE APPS SCRIPT (Code.gs)
 * ============================================================================
 */

const FOLDER_ARSIP_NAME = 'Arsip_Surat_Gedung_UNSRI';
const SPREADSHEET_DEFAULT_NAME = 'Database SIM-GEDUNG UNSRI';

/**
 * Menyajikan Web App ATAU REST API JSON (untuk GitHub Pages / Vercel)
 */
function doGet(e) {
  // Jika dipanggil via REST API GET (misal dari Vercel/GitHub Pages dengan query param ?action=...)
  if (e && e.parameter && e.parameter.action) {
    return handleRestApi(e.parameter.action, e.parameter);
  }

  // Jika dibuka langsung via browser di Apps Script
  try {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('SIM-GEDUNG UNSRI | Sistem Peminjaman & Penyewaan Gedung')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (errIdx) {
    return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('SIM-GEDUNG UNSRI | Sistem Peminjaman & Penyewaan Gedung')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

/**
 * Menerima Request POST REST API dari GitHub Pages, Vercel, dsb. (Anti-CORS text/plain)
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = e.parameter || {};
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action || (e && e.parameter && e.parameter.action) || '';
    const data = payload.data !== undefined ? payload.data : payload;
    const authToken = payload.token || (data && data._token) || (e && e.parameter && e.parameter.token) || '';

    return handleRestApi(action, data, authToken);
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

/**
 * Router Pusat REST API untuk Frontend Eksternal (Vercel & GitHub Pages)
 */
function handleRestApi(action, data, authToken) {
  try {
    let result = null;
    const reqData = (data && typeof data === 'object') ? data : {};
    const token = authToken || reqData._token || '';

    switch (action) {
      case 'getInitialData':
        result = getInitialData(token);
        break;

      case 'loginUser':
        result = loginUser(reqData.username || reqData.user, reqData.password || reqData.pass);
        break;

      case 'logoutUser':
        result = logoutUser(token);
        break;

      case 'createBookingWithFile':
        reqData._token = token;
        result = createBookingWithFile(reqData);
        break;

      case 'createManualBookingAdmin':
        reqData._token = token;
        result = createManualBookingAdmin(reqData);
        break;

      case 'replyBookingWithFile':
        reqData._token = token;
        result = replyBookingWithFile(reqData);
        break;

      case 'saveMasterGedung':
        result = saveMasterGedung(reqData.dataGedung || reqData, reqData.isEdit, token);
        break;

      case 'deleteMasterGedung':
        result = deleteMasterGedung(reqData.gedungId || reqData.id || data, token);
        break;

      case 'saveFonnteConfig':
        reqData._token = token;
        result = saveFonnteConfig(reqData);
        break;

      case 'testSendFonnteWA':
        result = testSendFonnteWA(reqData.token, reqData.targetWa || reqData.target, token);
        break;

      case 'sendRegistrationOtpWA':
        result = sendRegistrationOtpWA(reqData.noHp || reqData.hp, reqData.nama);
        break;

      case 'verifyRegistrationOtpWA':
        result = verifyRegistrationOtpWA(reqData.noHp || reqData.hp, reqData.inputCode || reqData.code || reqData.otp);
        break;

      case 'registerUser':
        result = registerUser(reqData);
        break;

      case 'getDriveFilePreview':
        result = getDriveFilePreview(reqData.fileUrl || reqData.url || data, token);
        break;

      case 'resolvePhotoUrl':
        result = resolvePhotoUrl(reqData.url || reqData.fileUrl || data, token);
        break;

      case 'verifyBookingPublic':
        result = verifyBookingPublic(reqData.bookingId || reqData.id || data, reqData.sig || '');
        break;

      case 'getAllUsers':
        result = getAllUsers(token);
        break;

      case 'createUserBySuperAdmin':
        result = createUserBySuperAdmin(reqData, token);
        break;

      case 'resetPasswordUserBySuperAdmin':
        result = resetPasswordUserBySuperAdmin(reqData, token);
        break;

      case 'deleteUserBySuperAdmin':
        result = deleteUserBySuperAdmin(reqData.userId || reqData.id || data, token);
        break;

      case 'getLoginLogs':
        result = getLoginLogs(token);
        break;

      case 'getWaLogs':
        result = getWaLogs(token);
        break;

      case 'setRegistrationEnabled':
        result = setRegistrationEnabled(reqData.enabled, token);
        break;

      case 'testKoneksiDatabase': {
        const auth = authenticateRequest(token, ['Admin', 'Super Admin']);
        if (!auth.authorized) {
          result = { status: 'error', authError: true, message: auth.message };
        } else {
          result = { status: 'success', message: testKoneksiDatabase() };
        }
        break;
      }

      default:
        result = { status: 'error', message: 'Action API tidak dikenal: ' + action };
        break;
    }

    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * FUNGSI DIAGNOSTIK & OTORISASI:
 * Jalankan fungsi ini langsung dari editor Apps Script (pilih 'testKoneksiDatabase' lalu klik 'Run')
 * untuk memberikan izin akses Google Drive & Spreadsheet pertama kali!
 */
function testKoneksiDatabase() {
  Logger.log('=== MEMULAI TES KONEKSI DATABASE OTOMATIS ===');
  try {
    const ss = getDbSpreadsheet();
    Logger.log('1. Berhasil mengakses Spreadsheet: ' + ss.getName() + ' (' + ss.getUrl() + ')');
    
    const setupMsg = setupDatabase();
    Logger.log('2. Status Setup Database: ' + setupMsg);

    const data = getInitialData();
    Logger.log('3. Data Gedung Terbaca: ' + (data.gedung ? data.gedung.length : 0) + ' gedung.');
    Logger.log('4. Data Booking Terbaca: ' + (data.booking ? data.booking.length : 0) + ' booking.');
    Logger.log('=== KONEKSI DATABASE BERHASIL & SEMUA IZIN AKTIF! ===');
    return 'SUKSES: Database terhubung ke ' + ss.getName() + ' (' + ss.getUrl() + ')';
  } catch (err) {
    Logger.log('❌ GAGAL: ' + err.toString());
    throw err;
  }
}

/**
 * Mendapatkan referensi Spreadsheet Database secara 100% Otomatis (Tanpa ID Manual):
 * 1. Otomatis deteksi spreadsheet aktif jika script dibuka dari Google Sheets (Ekstensi > Apps Script).
 * 2. Otomatis cek ID tersimpan di ScriptProperties.
 * 3. Otomatis cari file 'Database SIM-GEDUNG UNSRI' di Google Drive pengguna.
 * 4. Otomatis buat file spreadsheet baru di Google Drive jika belum ada sama sekali.
 */
function getDbSpreadsheet() {
  let ss = null;

  // 1. Coba getActiveSpreadsheet() jika script terikat ke Google Sheets (Container-bound)
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss && ss.getId()) {
      PropertiesService.getScriptProperties().setProperty('DB_SPREADSHEET_ID', ss.getId());
      return ss;
    }
  } catch (e) {
    // Standalone script
  }

  // 2. Coba dari ScriptProperties yang tersimpan sebelumnya
  try {
    const props = PropertiesService.getScriptProperties();
    const savedId = props.getProperty('DB_SPREADSHEET_ID');
    if (savedId) {
      try {
        ss = SpreadsheetApp.openById(savedId);
        if (ss) return ss;
      } catch (errOpen) {
        Logger.log('ID di ScriptProperties tidak dapat dibuka, menghapus cache ID...');
        props.deleteProperty('DB_SPREADSHEET_ID');
      }
    }
  } catch (e) {}

  // 3. Cari otomatis file di Google Drive dengan nama default
  try {
    const files = DriveApp.getFilesByName(SPREADSHEET_DEFAULT_NAME);
    while (files.hasNext()) {
      const file = files.next();
      if (!file.isTrashed()) {
        try {
          ss = SpreadsheetApp.openById(file.getId());
          if (ss) {
            PropertiesService.getScriptProperties().setProperty('DB_SPREADSHEET_ID', file.getId());
            Logger.log('Ditemukan spreadsheet di Google Drive: ' + ss.getName() + ' (' + file.getId() + ')');
            return ss;
          }
        } catch (eOpenDrive) {}
      }
    }
  } catch (e) {
    Logger.log('Pencarian file DriveApp: ' + e);
  }

  // 4. Jika belum ada sama sekali, buat baru otomatis di Google Drive
  try {
    ss = SpreadsheetApp.create(SPREADSHEET_DEFAULT_NAME);
    if (ss) {
      const newId = ss.getId();
      PropertiesService.getScriptProperties().setProperty('DB_SPREADSHEET_ID', newId);
      Logger.log('Spreadsheet baru otomatis dibuat di Google Drive: ' + ss.getName() + ' ID: ' + newId);
      return ss;
    }
  } catch (e) {
    throw new Error('Gagal menghubungkan atau membuat spreadsheet database otomatis. Pastikan akun telah memberikan izin Google Sheets & Drive: ' + e.message);
  }

  throw new Error('Database Spreadsheet tidak dapat diakses.');
}

/**
 * Utilitas Opsional: Hubungkan ke Spreadsheet spesifik jika diinginkan
 */
function hubungkanSpreadsheetById(spreadsheetId) {
  if (!spreadsheetId || spreadsheetId.trim() === '') {
    throw new Error('ID Spreadsheet tidak boleh kosong.');
  }
  const cleanId = spreadsheetId.trim();
  const ss = SpreadsheetApp.openById(cleanId);
  PropertiesService.getScriptProperties().setProperty('DB_SPREADSHEET_ID', cleanId);
  Logger.log('Berhasil menghubungkan Spreadsheet: ' + ss.getName() + ' (' + ss.getUrl() + ')');
  setupDatabase();
  return 'Berhasil terhubung ke: ' + ss.getName();
}

/**
 * Utilitas Opsional: Reset cache koneksi database agar mencari / membuat ulang
 */
function resetKoneksiDatabase() {
  PropertiesService.getScriptProperties().deleteProperty('DB_SPREADSHEET_ID');
  Logger.log('Cache database direset.');
  return getDbSpreadsheet().getUrl();
}

/**
 * Helper Keamanan: Escape HTML untuk mencegah XSS pada template PDF
 */
function escapeHtml_(str) {
  return String(str === undefined || str === null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Helper Keamanan: Konversi byte array ke hex string
 */
function bytesToHex_(rawBytes) {
  let hashStr = '';
  for (let i = 0; i < rawBytes.length; i++) {
    let byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    let byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hashStr += byteHex;
  }
  return hashStr;
}

/**
 * Helper Keamanan: Hashing Password dengan SHA-256 + Salt
 */
function hashPassword(password, existingSalt) {
  const salt = existingSalt || Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  const rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + String(password), Utilities.Charset.UTF_8);
  return 'sha256$' + salt + '$' + bytesToHex_(rawBytes);
}

/**
 * Helper Keamanan: Hash SHA-256 legacy (tanpa salt) untuk kompatibilitas migrasi akun lama
 */
function hashPasswordLegacy_(password) {
  const rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password), Utilities.Charset.UTF_8);
  return bytesToHex_(rawBytes);
}

/**
 * Verifikasi password terhadap format salted hash maupun legacy SHA-256
 */
function verifyPassword_(plainPassword, storedHash) {
  const stored = String(storedHash || '').trim();
  if (!stored) return false;
  if (stored.indexOf('sha256$') === 0) {
    const parts = stored.split('$');
    if (parts.length !== 3) return false;
    return hashPassword(plainPassword, parts[1]) === stored;
  }
  return hashPasswordLegacy_(plainPassword) === stored;
}

/**
 * Helper Keamanan: Secret & HMAC-SHA256 untuk verifikasi keaslian QR Code Surat Izin
 */
function getQrHmacSecret_() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('QR_HMAC_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + '-' + Utilities.getUuid();
    props.setProperty('QR_HMAC_SECRET', secret);
  }
  return secret;
}

function computeBookingHmac(bookingId) {
  const sigBytes = Utilities.computeHmacSha256Signature(String(bookingId || '').trim(), getQrHmacSecret_());
  return bytesToHex_(sigBytes).substring(0, 24);
}

/**
 * Helper Keamanan: Autentikasi Token Sesi & Pengecekan Role (Dengan Cache Cepat)
 */
function authenticateRequest(token, allowedRoles) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) {
    return { authorized: false, message: 'Autentikasi diperlukan. Silakan masuk terlebih dahulu.' };
  }
  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'AUTH_' + cleanToken.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cachedUser = cache.get(cacheKey);
    let user = null;

    if (cachedUser) {
      try {
        user = JSON.parse(cachedUser);
      } catch (eJson) {}
    }

    if (!user) {
      const ss = getDbSpreadsheet();
      const sheet = ss.getSheetByName('Users');
      if (!sheet || sheet.getLastRow() < 2) {
        return { authorized: false, message: 'Sesi tidak valid. Silakan login ulang.' };
      }
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (String(row[8] || '').trim() === cleanToken) {
          user = {
            id: String(row[0]),
            username: String(row[1]),
            nama: String(row[3]),
            kategori: String(row[4]),
            instansi: String(row[5]),
            noHp: String(row[6]),
            role: String(row[7]),
            token: cleanToken
          };
          // Cache sesi pengguna selama 10 menit (600 detik) untuk memangkas pembacaan berulang ke spreadsheet
          try {
            cache.put(cacheKey, JSON.stringify(user), 600);
          } catch (ePut) {}
          break;
        }
      }
    }

    if (user) {
      if (allowedRoles && allowedRoles.length > 0 && allowedRoles.indexOf(user.role) === -1) {
        return { authorized: false, forbidden: true, message: 'Akses ditolak: Anda tidak memiliki izin untuk aksi ini.' };
      }
      return { authorized: true, user: user };
    }
    return { authorized: false, message: 'Sesi tidak valid atau telah berakhir. Silakan login ulang.' };
  } catch (err) {
    return { authorized: false, message: 'Gagal memverifikasi sesi: ' + err.toString() };
  }
}

/**
 * Helper: Hapus Cache Sesi Pengguna saat logout / ganti password
 */
function invalidateUserSessionCache(token) {
  if (!token) return;
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('AUTH_' + String(token).trim().replace(/[^a-zA-Z0-9_-]/g, '_'));
  } catch (e) {}
}

/**
 * Memastikan akun bawaan (superadmin, admin, peserta) tersedia di sheet Users
 * tanpa menimpa password yang sudah diubah admin.
 */
function ensureDefaultUsers(ss) {
  try {
    let sheetUsers = ss.getSheetByName('Users');
    if (!sheetUsers) {
      sheetUsers = ss.insertSheet('Users');
    }
    if (sheetUsers.getLastRow() < 1) {
      sheetUsers.appendRow(['ID_User', 'Username', 'PasswordHash', 'Nama_Lengkap', 'Kategori_User', 'Instansi_Fakultas', 'No_HP', 'Role', 'Token']);
    }
    const rows = sheetUsers.getDataRange().getValues();
    const existingUsernames = {};
    for (let i = 1; i < rows.length; i++) {
      const u = String(rows[i][1] || '').trim().toLowerCase();
      if (u) existingUsernames[u] = true;
    }

    if (!existingUsernames['superadmin']) {
      sheetUsers.appendRow([
        'USR-00', 'superadmin', hashPassword('superadmin2026'), 'Super Admin UNSRI', 'Super Admin',
        'Rektorat Universitas Sriwijaya', '0711-580069', 'Super Admin', Utilities.getUuid()
      ]);
    }

    if (!existingUsernames['admin']) {
      sheetUsers.appendRow([
        'USR-01', 'admin', hashPassword('admin2026'), 'Administrator Fasilitas UNSRI', 'Admin',
        'Biro Umum & Perlengkapan UNSRI', '0711-580069', 'Admin', Utilities.getUuid()
      ]);
    }

    if (!existingUsernames['peserta']) {
      sheetUsers.appendRow([
        'USR-02', 'peserta', hashPassword('unsri2026'), 'Ahmad Fauzi', 'Mahasiswa/Ormawa',
        'BEM KM Universitas Sriwijaya', '081278901234', 'Penyewa', Utilities.getUuid()
      ]);
    }

    if (!existingUsernames['adminbus']) {
      sheetUsers.appendRow([
        'USR-03', 'adminbus', hashPassword('busunsri2026'), 'Pengelola Bus Kampus UNSRI', 'Admin Bus',
        'UPT Angkutan & Logistik UNSRI', '0711-580069', 'Admin Bus', Utilities.getUuid()
      ]);
    }

    if (!existingUsernames['admininput']) {
      sheetUsers.appendRow([
        'USR-04', 'admininput', hashPassword('admininput2026'), 'Admin Input Data UNSRI', 'Admin Input',
        'Biro Umum & Perlengkapan UNSRI', '0711-580069', 'Admin Input', Utilities.getUuid()
      ]);
    }

    if (!existingUsernames['operator']) {
      sheetUsers.appendRow([
        'USR-05', 'operator', hashPassword('operator2026'), 'Petugas Input Data UNSRI', 'Admin Input',
        'Biro Umum & Perlengkapan UNSRI', '0711-580069', 'Admin Input', Utilities.getUuid()
      ]);
    }
  } catch (e) {
    Logger.log('ensureDefaultUsers error: ' + e);
  }
}

/**
 * Inisialisasi Database Google Sheets & Akun Default
 */
function setupDatabase() {
  const ss = getDbSpreadsheet();
  if (!ss) throw new Error('Spreadsheet tidak ditemukan!');
  const ssUrl = ss.getUrl();

  // 1. Sheet Users
  let sheetUsers = ss.getSheetByName('Users');
  if (!sheetUsers) {
    sheetUsers = ss.insertSheet('Users');
  }
  if (sheetUsers.getLastRow() < 1) {
    sheetUsers.appendRow(['ID_User', 'Username', 'PasswordHash', 'Nama_Lengkap', 'Kategori_User', 'Instansi_Fakultas', 'No_HP', 'Role', 'Token']);
  }
  if (sheetUsers.getLastRow() === 1) {
    sheetUsers.appendRow([
      'USR-00', 'superadmin', hashPassword('superadmin2026'), 'Super Admin UNSRI', 'Super Admin',
      'Rektorat Universitas Sriwijaya', '0711-580069', 'Super Admin', Utilities.getUuid()
    ]);
    sheetUsers.appendRow([
      'USR-01', 'admin', hashPassword('admin2026'), 'Administrator Fasilitas UNSRI', 'Admin',
      'Biro Umum & Perlengkapan UNSRI', '0711-580069', 'Admin', Utilities.getUuid()
    ]);
    sheetUsers.appendRow([
      'USR-02', 'peserta', hashPassword('unsri2026'), 'Ahmad Fauzi', 'Mahasiswa/Ormawa',
      'BEM KM Universitas Sriwijaya', '081278901234', 'Penyewa', Utilities.getUuid()
    ]);
  } else {
    ensureDefaultUsers(ss);
  }

  // 2. Sheet Gedung
  let sheetGedung = ss.getSheetByName('Gedung');
  if (!sheetGedung) {
    sheetGedung = ss.insertSheet('Gedung');
  }
  if (sheetGedung.getLastRow() < 1) {
    sheetGedung.appendRow(['ID_Gedung', 'Nama_Gedung', 'Lokasi_Kampus', 'Kategori', 'Kapasitas', 'Tarif_Umum', 'Tarif_Internal', 'Fasilitas', 'URL_Gambar', 'Status_Gedung']);
  }
  if (sheetGedung.getLastRow() === 1) {
    sheetGedung.appendRow(['GDG-01', 'Auditorium Utama UNSRI Indralaya', 'Indralaya', 'Auditorium', 1500, 12000000, 0, 'AC Sentral, Videotron LED, Sound System Konser, Ruang VIP Rektorat, Parkir Luas', 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80', 'Aktif']);
    sheetGedung.appendRow(['GDG-02', 'Graha Sriwijaya Bukit Besar', 'Bukit Besar', 'Graha / Aula', 1000, 15000000, 1500000, 'Full Karpet, AC Central, Ruang Rias VIP, Panggung Permanen, Genset Backup', 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80', 'Aktif']);
    sheetGedung.appendRow(['GDG-03', 'Student Center UNSRI Indralaya', 'Indralaya', 'Graha / Aula', 600, 4500000, 0, 'Aula Serbaguna, Panggung Indoor, Sound System Standar, Area Bazar', 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80', 'Aktif']);
    sheetGedung.appendRow(['GDG-04', 'Ruang Sidang Utama KPA Bukit Besar', 'Bukit Besar', 'Ruang Sidang / Seminar', 200, 3500000, 0, 'Meja Konferensi, Proyektor Dual Screen, Teleconference System, AC, Pantry', 'https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&w=800&q=80', 'Aktif']);
  }

  // 3. Sheet Booking
  let sheetBooking = ss.getSheetByName('Booking');
  if (!sheetBooking) {
    sheetBooking = ss.insertSheet('Booking');
  }
  if (sheetBooking.getLastRow() < 1) {
    sheetBooking.appendRow([
      'ID_Booking', 'ID_Gedung', 'Nama_Gedung', 'Lokasi_Kampus', 'ID_User', 'Username',
      'Nama_Peminjam', 'Instansi_Ormawa', 'Kategori_Peminjam', 'No_HP', 'Nama_Acara',
      'Tanggal_Mulai', 'Tanggal_Selesai', 'Total_Biaya', 'URL_Surat_Permohonan',
      'Status_Booking', 'URL_Surat_Balasan', 'Catatan_Admin', 'Tanggal_Pengajuan', 'H1_Notified', 'H3_Notified', 'No_Surat_Permohonan'
    ]);
  }

  // 4. Sheet Pengaturan
  let sheetConfig = ss.getSheetByName('Pengaturan');
  if (!sheetConfig) {
    sheetConfig = ss.insertSheet('Pengaturan');
  }
  if (sheetConfig.getLastRow() < 1) {
    sheetConfig.appendRow(['Key', 'Value']);
    sheetConfig.appendRow(['FONNTE_TOKEN', '']);
    sheetConfig.appendRow(['ADMIN_WA', '']);
    sheetConfig.appendRow(['WA_ACTIVE', 'FALSE']);
    sheetConfig.appendRow(['REGISTRATION_ENABLED', 'FALSE']);
  }

  // 5. Sheet Log_Login
  let sheetLogLogin = ss.getSheetByName('Log_Login');
  if (!sheetLogLogin) {
    sheetLogLogin = ss.insertSheet('Log_Login');
  }
  if (sheetLogLogin.getLastRow() < 1) {
    sheetLogLogin.appendRow(['ID_Log', 'Waktu', 'ID_User', 'Username', 'Nama_Lengkap', 'Role', 'Status', 'Keterangan']);
  }

  // 6. Sheet Log_WA
  let sheetLogWa = ss.getSheetByName('Log_WA');
  if (!sheetLogWa) {
    sheetLogWa = ss.insertSheet('Log_WA');
  }
  if (sheetLogWa.getLastRow() < 1) {
    sheetLogWa.appendRow(['ID_Log', 'Waktu', 'Tujuan_No_WA', 'Tipe_Notifikasi', 'Pesan', 'Status_Kirim', 'Respon_API', 'Pengirim_User']);
  }

  // Hapus Sheet1 kosong bawaan jika ada
  const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
  if (defaultSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // Inisialisasi folder Drive
  getOrCreateArsipFolder();

  invalidateAppCache();
  return 'Database siap di: ' + ssUrl;
}

/**
 * Mengambil atau membuat folder Google Drive
 */
function getOrCreateArsipFolder() {
  try {
    const folders = DriveApp.getFoldersByName(FOLDER_ARSIP_NAME);
    if (folders.hasNext()) return folders.next();
    const newFolder = DriveApp.createFolder(FOLDER_ARSIP_NAME);
    try {
      newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}
    return newFolder;
  } catch (e) {
    Logger.log('Drive folder error: ' + e);
    return null;
  }
}

/**
 * Upload File Base64 ke Google Drive
 */
function uploadFileToDrive(fileObj, prefixName) {
  if (!fileObj || !fileObj.data) return '';
  try {
    const folder = getOrCreateArsipFolder();
    if (!folder) return '';

    let cleanBase64 = String(fileObj.data);
    if (cleanBase64.indexOf(',') > -1) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    const decoded = Utilities.base64Decode(cleanBase64);
    const safeName = `${prefixName}_${(fileObj.name || 'berkas.pdf').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const blob = Utilities.newBlob(decoded, fileObj.mimeType || 'application/pdf', safeName);
    const file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}
    return file.getUrl();
  } catch (err) {
    Logger.log('Upload error: ' + err);
    return '';
  }
}

/**
 * Mengambil atau membuat folder khusus Foto Gedung di Google Drive
 * Diletakkan di folder Foto_Gedung_UNSRI agar mudah diakses langsung di Google Drive
 */
function getOrCreateFotoGedungFolder() {
  const folderName = 'Foto_Gedung_UNSRI';
  try {
    const rootFolders = DriveApp.getFoldersByName(folderName);
    if (rootFolders.hasNext()) {
      const f = rootFolders.next();
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
      return f;
    }
    const newFolder = DriveApp.createFolder(folderName);
    try {
      newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}
    Logger.log('Folder foto gedung berhasil dibuat di Google Drive: ' + newFolder.getId());
    return newFolder;
  } catch (e) {
    Logger.log('Folder foto gedung error: ' + e);
    try {
      return getOrCreateArsipFolder() || DriveApp.getRootFolder();
    } catch (e2) {
      return null;
    }
  }
}

/**
 * Upload Foto Gedung dari Komputer ke Google Drive & Set Akses Publik
 * Mengembalikan URL direct image thumbnail agar langsung tampil di katalog tanpa login/CORS.
 */
function uploadFotoGedungToDrive(fileObj, gedungId) {
  if (!fileObj || !fileObj.data) {
    throw new Error('Data berkas foto kosong.');
  }
  try {
    const folder = getOrCreateFotoGedungFolder();
    if (!folder) {
      throw new Error('Folder penyimpanan foto di Google Drive tidak dapat diakses.');
    }

    let cleanBase64 = String(fileObj.data);
    if (cleanBase64.indexOf(',') > -1) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    cleanBase64 = cleanBase64.replace(/\s/g, '');

    const decoded = Utilities.base64Decode(cleanBase64);
    const originalName = fileObj.name || 'foto.jpg';
    let ext = '.jpg';
    const lastDot = originalName.lastIndexOf('.');
    if (lastDot > -1) {
      ext = originalName.substring(lastDot).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
        ext = '.jpg';
      }
    }
    const safeGedungId = (gedungId || 'GDG').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = `FOTO_${safeGedungId}_${Date.now()}${ext}`;
    const mimeType = fileObj.mimeType || (ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg'));
    const blob = Utilities.newBlob(decoded, mimeType, safeName);
    const file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      Logger.log('Set sharing foto error: ' + e);
    }
    const fileId = file.getId();
    Logger.log('Foto gedung tersimpan di Google Drive: ' + file.getName() + ' (ID: ' + fileId + ')');
    // Mengembalikan URL Google CDN langsung bebas blokir cookies pihak ketiga
    return 'https://lh3.googleusercontent.com/d/' + fileId + '=w1200';
  } catch (err) {
    Logger.log('Upload foto gedung error: ' + err);
    throw new Error('Gagal mengunggah foto gedung ke Google Drive: ' + err.message);
  }
}

/**
 * Resolusi Link Foto (Google Foto / Google Drive / URL Gambar)
 */
function resolvePhotoUrl(url, authToken) {
  try {
    if (!url) return { status: 'error', message: 'URL tidak boleh kosong.' };
    const str = String(url).trim();
    
    // 1. Cek Google Drive
    const driveId = extractDriveFileId(str);
    if (driveId) {
      return {
        status: 'success',
        url: 'https://lh3.googleusercontent.com/d/' + driveId + '=w1200',
        driveId: driveId
      };
    }
    
    // 2. Cek Google Photos share link
    if (/photos\.app\.goo\.gl|photos\.google\.com/i.test(str)) {
      try {
        const resp = UrlFetchApp.fetch(str, { followRedirects: true, muteHttpExceptions: true });
        const html = resp.getContentText();
        const m = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                  html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
        if (m && m[1]) {
          return { status: 'success', url: m[1], resolvedFromShare: true };
        }
      } catch (fetchErr) {
        Logger.log('Fetch photos error: ' + fetchErr);
      }
    }

    return { status: 'success', url: str };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Mengekstrak ID file Google Drive dari URL
 */
function extractDriveFileId(url) {
  if (!url) return '';
  const str = String(url);
  let m = str.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (m && m[1]) return m[1];
  m = str.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (m && m[1]) return m[1];
  return '';
}

/**
 * Mengambil data preview file (Gambar / PDF) dari Google Drive (Wajib Terautentikasi)
 */
function getDriveFilePreview(fileUrl, authToken) {
  try {
    const auth = authenticateRequest(authToken);
    if (!auth.authorized) {
      return { status: 'error', authError: true, message: auth.message };
    }

    const fileId = extractDriveFileId(fileUrl);
    if (!fileId) {
      return { status: 'error', message: 'ID file Google Drive tidak ditemukan.' };
    }

    // Pastikan file benar-benar terdaftar pada booking milik user atau user adalah Staf/Admin/Super Admin
    const isAdmin = auth.user.role === 'Admin' || auth.user.role === 'Super Admin' || auth.user.role === 'Admin Bus' || auth.user.role === 'Admin Input' || auth.user.role === 'Petugas Input' || auth.user.role === 'Operator';
    if (!isAdmin) {
      const ss = getDbSpreadsheet();
      const sheet = ss.getSheetByName('Booking');
      let allowed = false;
      if (sheet && sheet.getLastRow() > 1) {
        const rows = sheet.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          const isOwner = String(rows[i][4]) === auth.user.id || String(rows[i][5]) === auth.user.username;
          if (isOwner && (extractDriveFileId(rows[i][14]) === fileId || extractDriveFileId(rows[i][16]) === fileId)) {
            allowed = true;
            break;
          }
        }
      }
      if (!allowed) {
        return { status: 'error', message: 'Akses ditolak: Anda tidak berhak melihat berkas ini.' };
      }
    }

    const file = DriveApp.getFileById(fileId);
    const mimeType = file.getMimeType() || '';
    const name = file.getName() || 'Dokumen';
    const size = file.getSize();
    const previewUrl = 'https://drive.google.com/file/d/' + fileId + '/preview';
    const downloadUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;

    if (size <= 8 * 1024 * 1024 && (mimeType.indexOf('image/') === 0 || mimeType === 'application/pdf')) {
      const base64 = Utilities.base64Encode(file.getBlob().getBytes());
      return {
        status: 'success',
        fileId: fileId,
        name: name,
        mimeType: mimeType,
        base64: base64,
        previewUrl: previewUrl,
        downloadUrl: downloadUrl
      };
    }

    return {
      status: 'success',
      fileId: fileId,
      name: name,
      mimeType: mimeType,
      base64: '',
      previewUrl: previewUrl,
      downloadUrl: downloadUrl
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Helper Format Tanggal Bahasa Indonesia (mis. "16 November 2026" & "Sabtu tanggal 28 November 2026")
 */
function parseToDateObj_(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const iso = normalizeDateToIso(val);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function formatTanggalIndo_(val) {
  const d = parseToDateObj_(val);
  if (!d) return String(val || '-');
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function formatRentangHariTanggalIndo_(tglMulai, tglSelesai) {
  const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const d1 = parseToDateObj_(tglMulai);
  const d2 = parseToDateObj_(tglSelesai) || d1;
  if (!d1) return `${tglMulai || '-'} s/d ${tglSelesai || '-'}`;
  const iso1 = normalizeDateToIso(d1);
  const iso2 = normalizeDateToIso(d2);
  if (!d2 || iso1 === iso2) {
    return `${hari[d1.getDay()]} tanggal ${d1.getDate()} ${bulan[d1.getMonth()]} ${d1.getFullYear()}`;
  }
  if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
    return `${hari[d1.getDay()]} s/d ${hari[d2.getDay()]} tanggal ${d1.getDate()} s/d ${d2.getDate()} ${bulan[d1.getMonth()]} ${d1.getFullYear()}`;
  }
  return `${hari[d1.getDay()]} tanggal ${d1.getDate()} ${bulan[d1.getMonth()]} ${d1.getFullYear()} s/d ${hari[d2.getDay()]} tanggal ${d2.getDate()} ${bulan[d2.getMonth()]} ${d2.getFullYear()}`;
}

/**
 * Generate Surat Balasan / Izin Pemakaian Gedung Otomatis Berformat PDF Resmi BPU UNSRI (dengan QR HMAC)
 */
const LOGO_UNSRI_BASE64 = "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";

function generateOfficialPermissionPDF(bookingData) {
  try {
    const folder = getOrCreateArsipFolder();
    if (!folder) return '';

    let appUrl = 'https://script.google.com';
    const rawBaseUrl = String(bookingData.appBaseUrl || '').trim();
    const isUsablePublicUrl = /^https?:\/\//i.test(rawBaseUrl) &&
      !/googleusercontent\.com|localhost|127\.0\.0\.1/i.test(rawBaseUrl);
    if (isUsablePublicUrl) {
      appUrl = rawBaseUrl.split('?')[0].split('#')[0];
    } else {
      try {
        appUrl = ScriptApp.getService().getUrl() || appUrl;
      } catch (eUrl) {}
    }
    const sig = computeBookingHmac(bookingData.id);
    const sep = appUrl.indexOf('?') > -1 ? '&' : '?';
    const qrData = encodeURIComponent(`${appUrl}${sep}verify=${encodeURIComponent(bookingData.id)}&sig=${sig}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${qrData}`;

    const isDitolak = String(bookingData.status || '').trim() === 'Ditolak';
    const tahunNow = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy');
    const tglSuratIndo = formatTanggalIndo_(new Date());
    const nomorSurat = String(bookingData.nomorSurat || '').trim() || `.../UN9.BPU/SB3.BPU3/${tahunNow}`;
    const lampiran = String(bookingData.lampiran || '').trim() || '-';
    const perihal = String(bookingData.perihal || '').trim() || `Izin Pemakaian ${bookingData.namaGedung || 'Gedung'}\nUniversitas Sriwijaya`;
    const perihalHtml = escapeHtml_(perihal).replace(/\r?\n/g, '<br>');
    const ythTujuan = String(bookingData.ythTujuan || '').trim() || (bookingData.instansi ? `Pimpinan / ${bookingData.instansi}` : (bookingData.namaPeminjam || 'Pemohon'));
    const noSuratPemohon = String(bookingData.noSuratPemohon || '').trim() || '-';
    const tglSuratPemohon = bookingData.tglSuratPemohon
      ? (parseToDateObj_(bookingData.tglSuratPemohon) ? formatTanggalIndo_(bookingData.tglSuratPemohon) : String(bookingData.tglSuratPemohon).trim())
      : formatTanggalIndo_(bookingData.tglPengajuan || new Date());
    const jadwalPelaksanaan = formatRentangHariTanggalIndo_(bookingData.tglMulai, bookingData.tglSelesai);
    const catatanClean = String(bookingData.catatan || '').trim();

    let kalimatKeputusan = '';
    if (isDitolak) {
      const alasan = catatanClean || 'ada jadwal kegiatan lainnya';
      kalimatKeputusan = `dengan ini kami sampaikan bahwa permohonan saudara belum bisa kami penuhi dikarenakan ${escapeHtml_(alasan)}.`;
    } else {
      const biayaInfo = Number(bookingData.totalBiaya) > 0
        ? ` dengan ketentuan tarif pemakaian sebesar Rp ${Number(bookingData.totalBiaya).toLocaleString('id-ID')}`
        : '';
      kalimatKeputusan = `dengan ini kami sampaikan bahwa permohonan saudara dapat kami setujui${biayaInfo}.`;
    }

    const catatanTambahanHtml = (!isDitolak && catatanClean)
      ? `<div class="catatan-footer"><br><br><strong>Catatan:</strong> ${escapeHtml_(catatanClean)}</div>`
      : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          @page { size: A4; margin: 18mm 22mm 20mm 25mm; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 11.5pt; line-height: 1.5; color: #000; margin: 0; padding: 10px 18px; }
          .kop-wrap { border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 18px; }
          .kop-table { width: 100%; border-collapse: collapse; }
          .kop-table td { vertical-align: middle; padding: 0; }
          .kop-logo-cell { width: 92px; text-align: left; padding-right: 8px; }
          .kop-text-cell { text-align: center; line-height: 1.25; }
          .kop-kemen { font-size: 12pt; font-weight: normal; text-transform: uppercase; letter-spacing: 0.2px; }
          .kop-univ { font-size: 13.5pt; font-weight: normal; text-transform: uppercase; margin-top: 1px; }
          .kop-bpu { font-size: 14.5pt; font-weight: bold; text-transform: uppercase; margin-top: 1px; letter-spacing: 0.3px; }
          .kop-addr { font-size: 9pt; font-weight: normal; margin-top: 3px; }
          .kop-web { font-size: 9pt; font-weight: normal; margin-top: 1px; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 11.5pt; }
          .meta-table td { padding: 1.5px 0; vertical-align: top; }
          .meta-label { width: 78px; }
          .meta-colon { width: 14px; text-align: center; }
          .meta-date { text-align: right; white-space: nowrap; width: 155px; }
          .tujuan { margin-bottom: 18px; line-height: 1.45; }
          .tujuan .tempat { padding-left: 28px; }
          .body-para { text-align: justify; text-indent: 36px; margin: 0 0 12px 0; }
          .footer-table { width: 100%; border-collapse: collapse; margin-top: 28px; }
          .footer-table td { vertical-align: top; }
          .qr-cell { width: 42%; text-align: left; padding-top: 8px; }
          .qr-box { display: inline-block; text-align: center; font-size: 8.5pt; color: #333; }
          .sig-cell { width: 58%; padding-left: 40px; text-align: left; font-size: 11.5pt; line-height: 1.4; }
          .sig-space { height: 64px; }
          .sig-name { font-weight: bold; }
          .catatan-footer { font-size: 10pt; line-height: 1.4; text-align: left; color: #111; }
        </style>
      </head>
      <body>
        <div class="kop-wrap">
          <table class="kop-table">
            <tr>
              <td class="kop-logo-cell">
                <img src="data:image/png;base64,${LOGO_UNSRI_BASE64}" width="82" height="82" />
              </td>
              <td class="kop-text-cell">
                <div class="kop-kemen">KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI</div>
                <div class="kop-univ">UNIVERSITAS SRIWIJAYA</div>
                <div class="kop-bpu">BADAN PENGELOLA USAHA</div>
                <div class="kop-addr">Jl. Srijaya Negara, Bukit Lama, Kec. Ilir Barat I, Kota Palembang, Sumatera Selatan 30139</div>
                <div class="kop-web">Laman: bpu.unsri.ac.id</div>
              </td>
            </tr>
          </table>
        </div>

        <table class="meta-table">
          <tr>
            <td class="meta-label">Nomor</td>
            <td class="meta-colon">:</td>
            <td>${escapeHtml_(nomorSurat)}</td>
            <td class="meta-date">${escapeHtml_(tglSuratIndo)}</td>
          </tr>
          <tr>
            <td class="meta-label">Lampiran</td>
            <td class="meta-colon">:</td>
            <td colspan="2">${escapeHtml_(lampiran)}</td>
          </tr>
          <tr>
            <td class="meta-label">Perihal</td>
            <td class="meta-colon">:</td>
            <td colspan="2">${perihalHtml}</td>
          </tr>
        </table>

        <div class="tujuan">
          <div>Yth. ${escapeHtml_(ythTujuan)}</div>
          <div>di</div>
          <div class="tempat">Tempat</div>
        </div>

        <p class="body-para">
          Menindaklanjuti Surat nomor : ${escapeHtml_(noSuratPemohon)} tanggal ${escapeHtml_(tglSuratPemohon)} perihal Permohonan Pemakaian ${escapeHtml_(bookingData.namaGedung || '-')}, untuk kegiatan ${escapeHtml_(bookingData.namaAcara || '-')} oleh ${escapeHtml_(bookingData.instansi || bookingData.namaPeminjam || '-')} pada hari ${escapeHtml_(jadwalPelaksanaan)}, ${kalimatKeputusan}
        </p>

        <p class="body-para">Demikian, atas perhatiannya kami ucapkan terima kasih.</p>

        <table class="footer-table">
          <tr>
            <td class="qr-cell">
              <div class="qr-box">
                <img src="${qrUrl}" width="88" height="88" /><br>
                <span>Verifikasi Keaslian Surat</span><br>
                <span style="font-size:7.5pt;color:#555;">ID: ${escapeHtml_(bookingData.id)}</span>
              </div>
            </td>
            <td class="sig-cell">
              <div>Plt. Direktur,</div>
              <div class="sig-space"></div>
              <div class="sig-name">Prof. Dr. H. Zulkifli Dahlan., M.Si., DEA.</div>
              <div>NUPTK 3434726627130012</div>
            </td>
          </tr>
        </table>

        ${catatanTambahanHtml}
      </body>
      </html>
    `;

    const filePrefix = isDitolak ? 'SURAT_PENOLAKAN_' : 'SURAT_IZIN_RESMI_';
    const blob = HtmlService.createHtmlOutput(htmlContent).getAs('application/pdf');
    blob.setName(`${filePrefix}${String(bookingData.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
    const file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}
    return file.getUrl();
  } catch (err) {
    Logger.log('Gagal generate PDF: ' + err.toString());
    return '';
  }
}

/**
 * Verifikasi Dokumen Publik Berdasarkan ID Booking & Tanda Tangan HMAC (Untuk Pindai QR Code)
 */
function verifyBookingPublic(bookingId, sig) {
  try {
    const target = String(bookingId || '').trim();
    if (!target) {
      return { status: 'error', message: 'ID Booking tidak boleh kosong.' };
    }
    if (sig) {
      const expectedSig = computeBookingHmac(target);
      if (String(sig).trim() !== expectedSig) {
        return { status: 'error', message: 'Tanda tangan QR Code tidak valid atau dokumen telah dimodifikasi.' };
      }
    }

    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Booking');
    if (!sheet || sheet.getLastRow() < 2) {
      return { status: 'error', message: 'Data permohonan tidak ditemukan.' };
    }
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === target) {
        const isDisetujui = String(rows[i][15]) === 'Disetujui';
        return {
          status: 'success',
          valid: isDisetujui,
          hmacVerified: !!sig,
          data: {
            id: String(rows[i][0]),
            gedungId: String(rows[i][1]),
            namaGedung: String(rows[i][2]),
            lokasi: String(rows[i][3]),
            namaPeminjam: String(rows[i][6]),
            instansi: String(rows[i][7]),
            kategori: String(rows[i][8]),
            namaAcara: String(rows[i][10]),
            tglMulai: formatDateSheet(rows[i][11]),
            tglSelesai: formatDateSheet(rows[i][12]),
            status: String(rows[i][15]),
            urlSurat: String(rows[i][16] || ''),
            tglPengajuan: formatDateSheet(rows[i][18])
          }
        };
      }
    }
    return { status: 'error', message: 'ID Surat/Booking tidak terdaftar di sistem SIM-GEDUNG UNSRI.' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

const CACHE_KEY_INITIAL_DATA = 'SIM_GEDUNG_INITIAL_DATA_V2';
const CACHE_TTL_SECONDS = 180; // Cache 3 menit

/**
 * Helper: Hapus Cache saat ada perubahan data
 */
function invalidateAppCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove(CACHE_KEY_INITIAL_DATA);
  } catch (e) {
    Logger.log('invalidateAppCache error: ' + e);
  }
}

/**
 * Helper: Filter & Redaksi Data Sensitif Berdasarkan Role / Kepemilikan User
 */
function sanitizeInitialPayload_(rawPayload, auth) {
  const isSuper = auth && auth.authorized && auth.user.role === 'Super Admin';
  const isGeneralAdmin = auth && auth.authorized && auth.user.role === 'Admin';
  const isAdminBus = auth && auth.authorized && auth.user.role === 'Admin Bus';
  const isAdminInput = auth && auth.authorized && (auth.user.role === 'Admin Input' || auth.user.role === 'Petugas Input' || auth.user.role === 'Operator');
  const isAdmin = isSuper || isGeneralAdmin || isAdminBus || isAdminInput;
  const authUser = (auth && auth.authorized) ? auth.user : null;

  // Jika user adalah Admin Bus, data gedung HANYA kategori 'Bus Kampus'
  let rawGedung = rawPayload.gedung || [];
  if (isAdminBus) {
    rawGedung = rawGedung.filter(g => String(g.kategori || '').trim() === 'Bus Kampus');
  }

  // Identifikasi gedung bus untuk pemfilteran data peminjaman
  const busGedungIds = (rawPayload.gedung || [])
    .filter(g => String(g.kategori || '').trim() === 'Bus Kampus')
    .map(g => String(g.id));

  let sourceBookings = rawPayload.booking || [];
  if (isAdminBus) {
    // Admin Bus hanya menerima dan melihat peminjaman khusus kategori Bus Kampus
    sourceBookings = sourceBookings.filter(b => busGedungIds.includes(String(b.gedungId)));
  }

  const filteredBookings = sourceBookings.map(b => {
    const isOwner = authUser && (b.userId === authUser.id || b.username === authUser.username);
    if (isAdmin || isOwner) {
      return b;
    }
    return {
      id: b.id,
      gedungId: b.gedungId,
      namaGedung: b.namaGedung,
      lokasi: b.lokasi,
      userId: '',
      username: '',
      namaPeminjam: 'Pemohon Terdaftar',
      instansi: b.instansi,
      kategoriPeminjam: b.kategoriPeminjam,
      noHp: '',
      namaAcara: b.namaAcara,
      tglMulai: b.tglMulai,
      tglSelesai: b.tglSelesai,
      totalBiaya: 0,
      urlSuratPermohonan: '',
      status: b.status,
      urlSuratBalasan: '',
      catatanAdmin: '',
      tglPengajuan: b.tglPengajuan,
      noSuratPermohonan: ''
    };
  });

  const cfg = getFonnteConfig();
  return {
    status: 'success',
    spreadsheetName: rawPayload.spreadsheetName,
    spreadsheetUrl: isSuper || isGeneralAdmin ? rawPayload.spreadsheetUrl : '',
    gedung: rawGedung,
    booking: filteredBookings,
    fonnteConfig: isSuper ? cfg : { token: '', adminWa: '', isActive: cfg.isActive },
    registrationEnabled: isRegistrationEnabled_()
  };
}

/**
 * Mengambil Seluruh Data Awal untuk Frontend (Dengan Cache Cepat & Sanitasi Privasi)
 */
function getInitialData(authToken) {
  try {
    const auth = authToken ? authenticateRequest(authToken) : { authorized: false };

    // 1. Coba ambil dari CacheService (Respons kilat < 0.3 detik)
    try {
      const cache = CacheService.getScriptCache();
      const cached = cache.get(CACHE_KEY_INITIAL_DATA);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.status === 'success') {
          return sanitizeInitialPayload_(parsed, auth);
        }
      }
    } catch (eCacheRead) {}

    let ss = getDbSpreadsheet();
    if (!ss) { 
      return { 
        status: 'error', 
        message: 'Spreadsheet tidak dapat diakses. Silakan jalankan fungsi testKoneksiDatabase() di editor Apps Script.' 
      };
    }

    // Pastikan sheet-sheet utama ada
    if (!ss.getSheetByName('Gedung') || !ss.getSheetByName('Users') || !ss.getSheetByName('Booking')) {
      setupDatabase();
      ss = getDbSpreadsheet();
    } else {
      const props = PropertiesService.getScriptProperties();
      if (!props.getProperty('DEFAULT_USERS_SEEDED_V2')) {
        ensureDefaultUsers(ss);
        props.setProperty('DEFAULT_USERS_SEEDED_V2', '1');
      }
    }

    const sheetGedung = ss.getSheetByName('Gedung');
    const sheetBooking = ss.getSheetByName('Booking');

    const gedungData = [];
    if (sheetGedung && sheetGedung.getLastRow() > 1) {
      const allRows = sheetGedung.getDataRange().getValues();
      for (let i = 1; i < allRows.length; i++) {
        const r = allRows[i];
        if (r[0]) {
          gedungData.push({
            id: String(r[0]),
            nama: String(r[1] || ''),
            lokasi: String(r[2] || ''),
            kategori: String(r[3] || ''),
            kapasitas: Number(r[4]) || 0,
            tarifUmum: Number(r[5]) || 0,
            tarifInternal: Number(r[6]) || 0,
            fasilitas: String(r[7] || ''),
            gambar: String(r[8] || ''),
            status: String(r[9] || 'Aktif')
          });
        }
      }
    }

    const bookingData = [];
    if (sheetBooking && sheetBooking.getLastRow() > 1) {
      const allRows = sheetBooking.getDataRange().getValues();
      for (let i = allRows.length - 1; i >= 1; i--) {
        const r = allRows[i];
        if (r[0]) {
          bookingData.push({
            id: String(r[0]),
            gedungId: String(r[1] || ''),
            namaGedung: String(r[2] || ''),
            lokasi: String(r[3] || ''),
            userId: String(r[4] || ''),
            username: String(r[5] || ''),
            namaPeminjam: String(r[6] || ''),
            instansi: String(r[7] || ''),
            kategoriPeminjam: String(r[8] || ''),
            noHp: String(r[9] || ''),
            namaAcara: String(r[10] || ''),
            tglMulai: formatDateSheet(r[11]),
            tglSelesai: formatDateSheet(r[12]),
            totalBiaya: Number(r[13]) || 0,
            urlSuratPermohonan: String(r[14] || ''),
            status: String(r[15] || 'Menunggu Verifikasi'),
            urlSuratBalasan: String(r[16] || ''),
            catatanAdmin: String(r[17] || ''),
            tglPengajuan: formatDateSheet(r[18]),
            noSuratPermohonan: String(r[21] || '')
          });
        }
      }

      // Sort data booking berdasarkan tanggal terkini (terbaru di atas)
      bookingData.sort((a, b) => {
        const parseIso_ = (val) => {
          if (!val) return '';
          const s = String(val).trim();
          if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
            const p = s.split('-');
            return `${p[2]}-${p[1]}-${p[0]}`;
          }
          if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
            return s.substring(0, 10);
          }
          return s;
        };
        const tA = parseIso_(a.tglMulai) || parseIso_(a.tglPengajuan) || '';
        const tB = parseIso_(b.tglMulai) || parseIso_(b.tglPengajuan) || '';
        if (tB !== tA) return tB.localeCompare(tA);
        const pA = parseIso_(a.tglPengajuan) || '';
        const pB = parseIso_(b.tglPengajuan) || '';
        if (pB !== pA) return pB.localeCompare(pA);
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
    }

    const rawPayload = {
      status: 'success',
      spreadsheetName: ss.getName(),
      spreadsheetUrl: ss.getUrl(),
      gedung: gedungData,
      booking: bookingData
    };

    // 2. Simpan dataset mentah (tanpa token Fonnte) ke ScriptCache selama 180 detik jika ukuran < 95 KB
    try {
      const jsonStr = JSON.stringify(rawPayload);
      if (jsonStr.length < 95000) {
        CacheService.getScriptCache().put(CACHE_KEY_INITIAL_DATA, jsonStr, CACHE_TTL_SECONDS);
      }
    } catch (eCacheWrite) {}

    return sanitizeInitialPayload_(rawPayload, auth);
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Helper Logging: Catat riwayat login pengguna ke sheet Log_Login
 */
function recordLoginLog_(userInfo, status, keterangan) {
  try {
    const ss = getDbSpreadsheet();
    if (!ss) return;
    let sheet = ss.getSheetByName('Log_Login');
    if (!sheet) {
      sheet = ss.insertSheet('Log_Login');
      sheet.appendRow(['ID_Log', 'Waktu', 'ID_User', 'Username', 'Nama_Lengkap', 'Role', 'Status', 'Keterangan']);
    } else if (sheet.getLastRow() < 1) {
      sheet.appendRow(['ID_Log', 'Waktu', 'ID_User', 'Username', 'Nama_Lengkap', 'Role', 'Status', 'Keterangan']);
    }
    const now = new Date();
    const logId = 'LOG-IN-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyMMddHHmmss') + '-' + Math.floor(100 + Math.random() * 900);
    const waktu = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
    sheet.appendRow([
      logId,
      waktu,
      String((userInfo && userInfo.id) || ''),
      String((userInfo && userInfo.username) || ''),
      String((userInfo && userInfo.nama) || ''),
      String((userInfo && userInfo.role) || ''),
      String(status || 'Berhasil'),
      String(keterangan || '')
    ]);
  } catch (e) {
    Logger.log('recordLoginLog_ error: ' + e);
  }
}

/**
 * Helper Logging: Catat riwayat pengiriman WhatsApp ke sheet Log_WA
 */
function recordWaLog_(targetPhone, tipe, messageText, statusKirim, responApi, pengirimUser) {
  try {
    const ss = getDbSpreadsheet();
    if (!ss) return;
    let sheet = ss.getSheetByName('Log_WA');
    if (!sheet) {
      sheet = ss.insertSheet('Log_WA');
      sheet.appendRow(['ID_Log', 'Waktu', 'Tujuan_No_WA', 'Tipe_Notifikasi', 'Pesan', 'Status_Kirim', 'Respon_API', 'Pengirim_User']);
    } else if (sheet.getLastRow() < 1) {
      sheet.appendRow(['ID_Log', 'Waktu', 'Tujuan_No_WA', 'Tipe_Notifikasi', 'Pesan', 'Status_Kirim', 'Respon_API', 'Pengirim_User']);
    }
    const now = new Date();
    const logId = 'LOG-WA-' + Utilities.formatDate(now, 'Asia/Jakarta', 'yyMMddHHmmss') + '-' + Math.floor(100 + Math.random() * 900);
    const waktu = Utilities.formatDate(now, 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss');
    const pesanRingkas = String(messageText || '').substring(0, 1500);
    sheet.appendRow([
      logId,
      waktu,
      String(targetPhone || ''),
      String(tipe || 'Notifikasi Umum'),
      pesanRingkas,
      String(statusKirim || 'Gagal'),
      String(responApi || '').substring(0, 500),
      String(pengirimUser || 'Sistem')
    ]);
  } catch (e) {
    Logger.log('recordWaLog_ error: ' + e);
  }
}

/**
 * Autentikasi Login (Mendukung Salted SHA-256 & Migrasi Otomatis Hash Legacy)
 */
function loginUser(username, password) {
  try {
    if (!username || !password) {
      return { status: 'error', message: 'Username dan password wajib diisi.' };
    }
    let ss = getDbSpreadsheet();
    let sheet = ss.getSheetByName('Users');
    if (!sheet || sheet.getLastRow() < 2) {
      ensureDefaultUsers(ss);
      sheet = ss.getSheetByName('Users');
    }

    const allUsers = sheet.getDataRange().getValues();
    const targetUser = String(username).trim().toLowerCase();
    let matchedUserMeta = null;

    for (let i = 1; i < allUsers.length; i++) {
      const row = allUsers[i];
      const uName = String(row[1]).trim().toLowerCase();
      const storedHash = String(row[2]).trim();

      if (uName === targetUser) {
        matchedUserMeta = {
          id: String(row[0]),
          username: String(row[1]),
          nama: String(row[3]),
          role: String(row[7])
        };
      }

      if (uName === targetUser && verifyPassword_(password, storedHash)) {
        // Migrasi otomatis hash legacy (tanpa salt) ke salted hash
        if (storedHash.indexOf('sha256$') !== 0) {
          sheet.getRange(i + 1, 3).setValue(hashPassword(password));
        }
        const oldToken = String(row[8] || '').trim();
        if (oldToken) invalidateUserSessionCache(oldToken);

        const token = Utilities.getUuid();
        sheet.getRange(i + 1, 9).setValue(token);

        const userObj = {
          id: String(row[0]),
          username: String(row[1]),
          nama: String(row[3]),
          kategori: String(row[4]),
          instansi: String(row[5]),
          noHp: String(row[6]),
          role: String(row[7]),
          token: token
        };
        recordLoginLog_(userObj, 'Berhasil', 'Login berhasil');
        return {
          status: 'success',
          user: userObj
        };
      }
    }

    recordLoginLog_(
      matchedUserMeta || { id: '', username: targetUser, nama: '-', role: '-' },
      'Gagal',
      matchedUserMeta ? 'Password salah' : 'Username tidak terdaftar'
    );
    return { status: 'error', message: 'Username atau Password salah.' };
  } catch (err) {
    return { status: 'error', message: 'Error DB: ' + err.toString() };
  }
}

/**
 * Menghapus token sesi pengguna saat logout
 */
function logoutUser(authToken) {
  try {
    const cleanToken = String(authToken || '').trim();
    if (!cleanToken) return { status: 'success' };
    invalidateUserSessionCache(cleanToken);
    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Users');
    if (sheet && sheet.getLastRow() > 1) {
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][8] || '').trim() === cleanToken) {
          sheet.getRange(i + 1, 9).setValue('');
          break;
        }
      }
    }
    return { status: 'success' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Konfigurasi Fonnte (Dengan Cache Cepat 30 Menit)
 */
function getFonnteConfig() {
  const cfg = { token: '', adminWa: '', isActive: false };
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('CFG_FONNTE');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (eJson) {}
    }

    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Pengaturan');
    if (!sheet || sheet.getLastRow() < 2) return cfg;

    const allRows = sheet.getDataRange().getValues();
    for (let i = 1; i < allRows.length; i++) {
      const k = allRows[i][0];
      const v = allRows[i][1];
      if (k === 'FONNTE_TOKEN') cfg.token = String(v || '').trim();
      if (k === 'ADMIN_WA') cfg.adminWa = String(v || '').trim();
      if (k === 'WA_ACTIVE') cfg.isActive = String(v).toUpperCase() === 'TRUE';
    }

    try {
      cache.put('CFG_FONNTE', JSON.stringify(cfg), 1800);
    } catch (ePut) {}
  } catch (e) {}
  return cfg;
}

function isRegistrationEnabled_() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('CFG_REG_ENABLED');
    if (cached !== null) return cached === 'TRUE';

    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Pengaturan');
    let enabled = false; // Default: Nonaktif
    if (sheet && sheet.getLastRow() >= 2) {
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0] || '').trim() === 'REGISTRATION_ENABLED') {
          enabled = String(rows[i][1] || '').toUpperCase().trim() === 'TRUE';
          break;
        }
      }
    }
    try {
      cache.put('CFG_REG_ENABLED', enabled ? 'TRUE' : 'FALSE', 1800);
    } catch (ePut) {}
    return enabled;
  } catch (e) {
    return false;
  }
}

function setRegistrationEnabled(enabled, authToken) {
  try {
    const auth = authenticateRequest(authToken, ['Super Admin']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }
    const valStr = (enabled === true || String(enabled).toUpperCase() === 'TRUE') ? 'TRUE' : 'FALSE';
    const ss = getDbSpreadsheet();
    let sheet = ss.getSheetByName('Pengaturan');
    if (!sheet) {
      sheet = ss.insertSheet('Pengaturan');
      sheet.appendRow(['Key', 'Value']);
    }
    const rows = sheet.getDataRange().getValues();
    let updated = false;
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0] || '').trim() === 'REGISTRATION_ENABLED') {
        sheet.getRange(i + 1, 2).setValue(valStr);
        updated = true;
        break;
      }
    }
    if (!updated) {
      sheet.appendRow(['REGISTRATION_ENABLED', valStr]);
    }
    try {
      CacheService.getScriptCache().put('CFG_REG_ENABLED', valStr, 1800);
    } catch (eCache) {}
    invalidateAppCache();
    return {
      status: 'success',
      registrationEnabled: valStr === 'TRUE',
      message: valStr === 'TRUE'
        ? 'Pendaftaran akun mandiri telah DIAKTIFKAN.'
        : 'Pendaftaran akun mandiri telah DINONAKTIFKAN.'
    };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

function saveFonnteConfig(newCfg) {
  try {
    const auth = authenticateRequest(newCfg && newCfg._token, ['Super Admin']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }
    const regEnabledStr = isRegistrationEnabled_() ? 'TRUE' : 'FALSE';
    const ss = getDbSpreadsheet();
    let sheet = ss.getSheetByName('Pengaturan');
    if (!sheet) sheet = ss.insertSheet('Pengaturan');
    sheet.clear();
    // Optimalisasi: Batch write sekaligus 5 baris data konfigurasi (tetap menjaga status REGISTRATION_ENABLED)
    const configRows = [
      ['Key', 'Value'],
      ['FONNTE_TOKEN', (newCfg.token || '').trim()],
      ['ADMIN_WA', (newCfg.adminWa || '').trim()],
      ['WA_ACTIVE', newCfg.isActive ? 'TRUE' : 'FALSE'],
      ['REGISTRATION_ENABLED', regEnabledStr]
    ];
    sheet.getRange(1, 1, 5, 2).setValues(configRows);
    try {
      CacheService.getScriptCache().remove('CFG_FONNTE');
    } catch (eCache) {}
    invalidateAppCache();
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

function testSendFonnteWA(token, targetWa, authToken) {
  const auth = authenticateRequest(authToken, ['Super Admin']);
  if (!auth.authorized) {
    return { status: 'error', authError: !auth.forbidden, message: auth.message };
  }
  const pesan = '✅ *TES KONEKSI FONNTE BERHASIL*\n\nSistem Notifikasi WhatsApp *SIM-GEDUNG UNSRI* telah terhubung dengan baik.';
  return sendFonnteMessage(targetWa, pesan, token, { tipe: 'Tes Koneksi WA', pengirim: auth.user.username });
}

function sendFonnteMessage(targetPhone, messageText, overrideToken, logMeta) {
  const meta = (logMeta && typeof logMeta === 'object') ? logMeta : {};
  const tipeNotif = meta.tipe || 'Notifikasi Umum';
  const pengirim = meta.pengirim || 'Sistem';
  const cleanPhone = String(targetPhone || '').replace(/\D/g, '');
  try {
    const cfg = getFonnteConfig();
    const token = overrideToken ? overrideToken.trim() : cfg.token;
    if (!token) {
      recordWaLog_(cleanPhone || String(targetPhone || ''), tipeNotif, messageText, 'Gagal', 'Token Fonnte belum diatur.', pengirim);
      return { status: 'error', message: 'Token Fonnte belum diatur.' };
    }
    if (!overrideToken && !cfg.isActive) {
      recordWaLog_(cleanPhone || String(targetPhone || ''), tipeNotif, messageText, 'Dilewati', 'Notifikasi WA dinonaktifkan di pengaturan.', pengirim);
      return { status: 'skipped', message: 'Notifikasi WA dinonaktifkan di pengaturan.' };
    }

    const response = UrlFetchApp.fetch('https://api.fonnte.com/send', {
      method: 'post',
      headers: { 'Authorization': token },
      payload: {
        'target': cleanPhone,
        'message': messageText,
        'countryCode': '62'
      },
      muteHttpExceptions: true
    });

    const rawResp = response.getContentText();
    let result = {};
    try {
      result = JSON.parse(rawResp);
    } catch (eParse) {
      result = { status: false, reason: rawResp };
    }
    if (result.status) {
      recordWaLog_(cleanPhone, tipeNotif, messageText, 'Terkirim', result.detail || 'OK', pengirim);
      return { status: 'success' };
    } else {
      const errMsg = result.reason || 'Gagal mengirim pesan via Fonnte.';
      recordWaLog_(cleanPhone, tipeNotif, messageText, 'Gagal', errMsg, pengirim);
      return { status: 'error', message: errMsg };
    }
  } catch (err) {
    recordWaLog_(cleanPhone || String(targetPhone || ''), tipeNotif, messageText, 'Gagal', err.toString(), pengirim);
    return { status: 'error', message: err.toString() };
  }
}

function sendRegistrationOtpWA(noHp, nama) {
  try {
    if (!isRegistrationEnabled_()) {
      return { status: 'error', message: 'Pendaftaran akun mandiri saat ini sedang dinonaktifkan oleh Administrator.' };
    }
    const cleanPhone = String(noHp).replace(/\D/g, '');
    if (cleanPhone.length < 9) return { status: 'error', message: 'Nomor WhatsApp tidak valid.' };

    const cache = CacheService.getScriptCache();
    if (cache.get('OTP_CD_' + cleanPhone)) {
      return { status: 'error', message: 'Tunggu 30 detik sebelum meminta ulang kode OTP.' };
    }

    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    cache.put('OTP_REG_' + cleanPhone, otpCode, 600);
    cache.put('OTP_CD_' + cleanPhone, '1', 30);

    const pesanOtp = `🔐 *KODE OTP REGISTRASI SIM-GEDUNG UNSRI*\n\nHalo *${String(nama || 'Pemohon').trim()}*,\nGunakan kode OTP: *${otpCode}* (Berlaku 10 menit).`;
    return sendFonnteMessage(cleanPhone, pesanOtp, null, { tipe: 'OTP Registrasi', pengirim: 'Sistem' });
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function verifyRegistrationOtpWA(noHp, inputCode) {
  try {
    const cleanPhone = String(noHp).replace(/\D/g, '');
    const cache = CacheService.getScriptCache();
    const savedOtp = cache.get('OTP_REG_' + cleanPhone);

    if (!savedOtp) return { status: 'error', message: 'Kode OTP kedaluwarsa atau belum diminta.' };
    if (String(inputCode).trim() !== String(savedOtp).trim()) return { status: 'error', message: 'Kode OTP tidak sesuai.' };

    cache.remove('OTP_REG_' + cleanPhone);
    cache.put('OTP_VERIFIED_' + cleanPhone, '1', 900);
    return { status: 'success' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function registerUser(payload) {
  const lock = LockService.getScriptLock();
  try {
    if (!isRegistrationEnabled_()) {
      return { status: 'error', message: 'Pendaftaran akun mandiri saat ini sedang dinonaktifkan oleh Administrator.' };
    }
    lock.waitLock(15000);
    if (!payload || !payload.username || !payload.password || !payload.nama || !payload.noHp) {
      return { status: 'error', message: 'Seluruh field wajib diisi.' };
    }
    const cleanPhone = String(payload.noHp).replace(/\D/g, '');
    const cache = CacheService.getScriptCache();
    if (cache.get('OTP_VERIFIED_' + cleanPhone) !== '1') {
      return { status: 'error', message: 'Nomor WhatsApp belum terverifikasi OTP di server.' };
    }

    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Users');
    const allUsers = sheet.getDataRange().getValues();
    const reqUsername = String(payload.username).trim();

    for (let i = 1; i < allUsers.length; i++) {
      if (String(allUsers[i][1]).toLowerCase().trim() === reqUsername.toLowerCase()) {
        return { status: 'error', message: 'Username sudah digunakan, silakan pilih yang lain.' };
      }
    }

    const newId = 'USR-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyMMddHHmmss');
    const token = Utilities.getUuid();
    const pwdHash = hashPassword(payload.password);

    sheet.appendRow([
      newId, reqUsername, pwdHash, String(payload.nama).trim(), String(payload.kategori || 'Umum/Eksternal'),
      String(payload.instansi || '').trim(), String(payload.noHp).trim(), 'Penyewa', token
    ]);

    cache.remove('OTP_VERIFIED_' + cleanPhone);

    return {
      status: 'success',
      user: {
        id: newId, username: reqUsername, nama: String(payload.nama).trim(),
        kategori: String(payload.kategori || 'Umum/Eksternal'), instansi: String(payload.instansi || '').trim(),
        noHp: String(payload.noHp).trim(), role: 'Penyewa', token: token
      }
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Helper: Cek bentrok jadwal booking pada gedung & rentang tanggal tertentu
 */
function checkDateConflict_(bookingRows, gedungId, reqStartIso, reqEndIso, excludeBookingId, onlyApproved) {
  for (let i = 1; i < bookingRows.length; i++) {
    const row = bookingRows[i];
    const rowId = String(row[0] || '');
    if (excludeBookingId && rowId === String(excludeBookingId)) continue;
    const rowGedung = String(row[1] || '');
    const rowStatus = String(row[15] || '');
    if (rowGedung !== String(gedungId) || rowStatus === 'Ditolak') continue;
    if (onlyApproved && rowStatus !== 'Disetujui') continue;

    const rowStart = normalizeDateToIso(row[11]);
    const rowEnd = normalizeDateToIso(row[12]);
    if (!(reqEndIso < rowStart || reqStartIso > rowEnd)) {
      return true;
    }
  }
  return false;
}

/**
 * Helper: Lookup gedung dari sheet Gedung dan hitung biaya resmi di sisi server
 */
function findGedungAndComputeFee_(ss, gedungId, kategoriPeminjam, reqStartIso, reqEndIso) {
  const sheetGedung = ss.getSheetByName('Gedung');
  if (!sheetGedung || sheetGedung.getLastRow() < 2) return null;
  const rows = sheetGedung.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === String(gedungId)) {
      const startParts = reqStartIso.split('-').map(Number);
      const endParts = reqEndIso.split('-').map(Number);
      const dStart = new Date(startParts[0], startParts[1] - 1, startParts[2]);
      const dEnd = new Date(endParts[0], endParts[1] - 1, endParts[2]);
      const days = Math.max(1, Math.floor((dEnd - dStart) / 86400000) + 1);
      const tarifUmum = Number(rows[i][5]) || 0;
      const tarifInternal = Number(rows[i][6]) || 0;
      const tarif = kategoriPeminjam === 'Internal Unsri' ? tarifInternal : tarifUmum;
      return {
        id: String(rows[i][0]),
        nama: String(rows[i][1] || ''),
        lokasi: String(rows[i][2] || ''),
        status: String(rows[i][9] || 'Aktif'),
        totalBiaya: tarif * days
      };
    }
  }
  return null;
}

function createBookingWithFile(payload) {
  const lock = LockService.getScriptLock();
  try {
    const auth = authenticateRequest(payload && payload._token);
    if (!auth.authorized) {
      return { status: 'error', authError: true, message: auth.message };
    }

    lock.waitLock(15000);
    const ss = getDbSpreadsheet();
    const reqStart = normalizeDateToIso(payload.tglMulai);
    const reqEnd = normalizeDateToIso(payload.tglSelesai);
    if (!reqStart || !reqEnd || reqEnd < reqStart) {
      return { status: 'error', message: 'Rentang tanggal tidak valid.' };
    }

    const gedungInfo = findGedungAndComputeFee_(ss, payload.gedungId, payload.kategoriPeminjam, reqStart, reqEnd);
    if (!gedungInfo) {
      return { status: 'error', message: 'Gedung tidak ditemukan.' };
    }
    if (gedungInfo.status !== 'Aktif') {
      return { status: 'error', message: 'Gedung sedang dalam perawatan dan tidak dapat dipesan.' };
    }

    const sheet = ss.getSheetByName('Booking');
    if (sheet.getLastRow() > 1) {
      const existing = sheet.getDataRange().getValues();
      if (checkDateConflict_(existing, gedungInfo.id, reqStart, reqEnd, null, false)) {
        return { status: 'error', message: 'Maaf, gedung ini baru saja dipesan pada tanggal tersebut oleh pemohon lain.' };
      }
    }

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const bookingId = 'BKG-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmm') + '-' + randomSuffix;
    
    let urlSurat = '';
    if (payload.fileSurat && payload.fileSurat.data) {
      urlSurat = uploadFileToDrive(payload.fileSurat, `PERMOHONAN_${bookingId}`);
    }
    const tglPengajuan = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy');
    const tglMulaiDisp = formatDateSheet(reqStart);
    const tglSelesaiDisp = formatDateSheet(reqEnd);

    if (sheet.getLastColumn() < 22) {
      sheet.getRange(1, 22).setValue('No_Surat_Permohonan');
    }

    sheet.appendRow([
      bookingId, gedungInfo.id, gedungInfo.nama, gedungInfo.lokasi, auth.user.id,
      auth.user.username, auth.user.nama, String(payload.instansi || auth.user.instansi || '').trim(),
      String(payload.kategoriPeminjam || 'Umum'), String(payload.noHp || auth.user.noHp || '').trim(),
      String(payload.namaAcara || '').trim(), tglMulaiDisp, tglSelesaiDisp, gedungInfo.totalBiaya,
      urlSurat, 'Menunggu Verifikasi', '', '', tglPengajuan, 'NO', 'NO', String(payload.noSuratPermohonan || '').trim()
    ]);

    invalidateAppCache();
    lock.releaseLock();

    // Notifikasi WA dipanggil di luar lock agar tidak memblokir proses antrean pengguna lain
    const cfg = getFonnteConfig();
    if (cfg.isActive && cfg.adminWa) {
      const pesan = `🏛️ *PENGAJUAN PINJAM GEDUNG BARU*\n\n` +
        `• *ID:* ${bookingId}\n` +
        `• *Gedung:* ${gedungInfo.nama} (${gedungInfo.lokasi})\n` +
        `• *Pemohon:* ${auth.user.nama} (${payload.instansi})\n` +
        `• *Acara:* ${payload.namaAcara}\n` +
        `• *Tanggal:* ${tglMulaiDisp} s/d ${tglSelesaiDisp}\n` +
        `• *No. WA:* ${payload.noHp}\n` +
        `• *Surat:* ${urlSurat || 'Tidak ada'}\n\n` +
        `Silakan verifikasi melalui Panel Admin SIM-GEDUNG UNSRI.`;
      sendFonnteMessage(cfg.adminWa, pesan, null, { tipe: 'Pengajuan Baru (Admin)', pengirim: auth.user.username });
    }

    return { status: 'success', bookingId: bookingId };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  } finally {
    try { lock.releaseLock(); } catch (eLock) {}
  }
}

function createManualBookingAdmin(payload) {
  const lock = LockService.getScriptLock();
  try {
    const auth = authenticateRequest(payload && payload._token, ['Admin', 'Super Admin', 'Admin Bus', 'Admin Input', 'Petugas Input', 'Operator']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }

    lock.waitLock(15000);
    const ss = getDbSpreadsheet();

    // Restriksi Admin Bus: Hanya boleh memesan armada Bus Kampus
    if (auth.user.role === 'Admin Bus') {
      const gSheet = ss.getSheetByName('Gedung');
      let isBus = false;
      if (gSheet && gSheet.getLastRow() > 1) {
        const gRows = gSheet.getDataRange().getValues();
        for (let j = 1; j < gRows.length; j++) {
          if (String(gRows[j][0]) === String(payload.gedungId) && String(gRows[j][3]).trim() === 'Bus Kampus') {
            isBus = true;
            break;
          }
        }
      }
      if (!isBus) {
        return { status: 'error', message: 'Akses ditolak: Admin Bus hanya dapat memesan fasilitas kategori Bus Kampus.' };
      }
    }

    const reqStart = normalizeDateToIso(payload.tglMulai);
    const reqEnd = normalizeDateToIso(payload.tglSelesai);
    if (!reqStart || !reqEnd || reqEnd < reqStart) {
      return { status: 'error', message: 'Rentang tanggal tidak valid.' };
    }

    const sheet = ss.getSheetByName('Booking');
    if (payload.status !== 'Ditolak' && sheet.getLastRow() > 1) {
      const existing = sheet.getDataRange().getValues();
      if (checkDateConflict_(existing, payload.gedungId, reqStart, reqEnd, null, false)) {
        return { status: 'error', message: 'Jadwal bentrok dengan pemesanan aktif lain pada gedung & tanggal tersebut.' };
      }
    }

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const bookingId = 'BKG-MAN-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmm') + '-' + randomSuffix;
    
    let urlSurat = 'INPUT_MANUAL_ADMIN';
    if (payload.fileSurat && payload.fileSurat.data) {
      urlSurat = uploadFileToDrive(payload.fileSurat, `MANUAL_${bookingId}`);
    }
    const tglPengajuan = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd-MM-yyyy');
    let urlBalasan = '';

    const noSuratPermohonan = String(payload.noSuratPermohonan || '').trim();
    if (payload.status === 'Disetujui') {
      urlBalasan = generateOfficialPermissionPDF({
        id: bookingId,
        status: payload.status,
        namaGedung: payload.namaGedung,
        lokasi: payload.lokasi,
        namaPeminjam: payload.namaPeminjam,
        instansi: payload.instansi,
        kategoriPeminjam: payload.kategoriPeminjam,
        namaAcara: payload.namaAcara,
        tglMulai: formatDateSheet(reqStart),
        tglSelesai: formatDateSheet(reqEnd),
        tglPengajuan: tglPengajuan,
        totalBiaya: Number(payload.totalBiaya) || 0,
        catatan: payload.catatanAdmin,
        noSuratPemohon: noSuratPermohonan,
        appBaseUrl: payload.appBaseUrl || ''
      });
    }

    if (sheet.getLastColumn() < 22) {
      sheet.getRange(1, 22).setValue('No_Surat_Permohonan');
    }

    sheet.appendRow([
      bookingId, payload.gedungId, payload.namaGedung, payload.lokasi, auth.user.id,
      auth.user.username, payload.namaPeminjam, payload.instansi, payload.kategoriPeminjam,
      payload.noHp, payload.namaAcara, formatDateSheet(reqStart), formatDateSheet(reqEnd), Number(payload.totalBiaya) || 0,
      urlSurat, payload.status, urlBalasan, payload.catatanAdmin, tglPengajuan, 'NO', 'NO', noSuratPermohonan
    ]);

    invalidateAppCache();
    lock.releaseLock();

    // Notifikasi WhatsApp dikirimkan di luar lock (ke Penyewa & ke Admin)
    const cfg = getFonnteConfig();
    if (payload.noHp) {
      const pesan = `🏛️ *KONFIRMASI JADWAL GEDUNG UNSRI*\n\n` +
        `Halo *${payload.namaPeminjam}* (${payload.instansi}),\n` +
        `Jadwal peminjaman gedung Anda telah dicatat oleh Admin SIM-GEDUNG UNSRI:\n\n` +
        `• *ID:* ${bookingId}\n` +
        `• *Gedung/Fasilitas:* ${payload.namaGedung}\n` +
        `• *Acara:* ${payload.namaAcara}\n` +
        `• *Tanggal:* ${formatDateSheet(reqStart)} s/d ${formatDateSheet(reqEnd)}\n` +
        `• *Status:* *${payload.status.toUpperCase()}*\n\n` +
        (urlBalasan ? `📄 *Surat Izin Resmi:* ${urlBalasan}\n\n` : '') +
        `Silakan menunggu konfirmasi hasil Verifikasi Admin Gedung/Fasilitas Kampus`;
      sendFonnteMessage(payload.noHp, pesan, null, { tipe: 'Booking Manual (Penyewa)', pengirim: auth.user.username });
    }
    if (cfg.isActive && cfg.adminWa) {
      const pesanAdmin = `📝 *INPUT BOOKING MANUAL BARU*\n\n` +
        `• *ID:* ${bookingId}\n` +
        `• *Gedung/Fasilitas:* ${payload.namaGedung} (${payload.lokasi || '-'})\n` +
        `• *Pemohon:* ${payload.namaPeminjam} (${payload.instansi || '-'})\n` +
        `• *Acara:* ${payload.namaAcara}\n` +
        `• *Tanggal:* ${formatDateSheet(reqStart)} s/d ${formatDateSheet(reqEnd)}\n` +
        `• *No. WA Penyewa:* ${payload.noHp || '-'}\n` +
        `• *Status:* *${String(payload.status || '').toUpperCase()}*\n` +
        `• *Diinput oleh:* ${auth.user.nama} (${auth.user.role})\n` +
        (urlBalasan ? `• 📄 *Surat Resmi:* ${urlBalasan}\n` : '') +
        `\nData telah tersimpan di SIM-GEDUNG UNSRI.`;
      sendFonnteMessage(cfg.adminWa, pesanAdmin, null, { tipe: 'Booking Manual (Admin)', pengirim: auth.user.username });
    }

    return { status: 'success', bookingId: bookingId };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  } finally {
    try { lock.releaseLock(); } catch (eLock) {}
  }
}

function replyBookingWithFile(payload) {
  const lock = LockService.getScriptLock();
  try {
    const auth = authenticateRequest(payload && payload._token, ['Admin', 'Super Admin', 'Admin Bus']);
    if (!auth.authorized) {
      if (auth.user && (auth.user.role === 'Admin Input' || auth.user.role === 'Petugas Input' || auth.user.role === 'Operator')) {
        return { status: 'error', message: 'Akses ditolak: Akun Admin Input tidak memiliki wewenang untuk menyetujui atau membalas permohonan.' };
      }
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }

    lock.waitLock(15000);
    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Booking');
    const rows = sheet.getDataRange().getValues();

    // Restriksi Admin Bus: Hanya boleh memutuskan peminjaman armada Bus Kampus
    if (auth.user.role === 'Admin Bus') {
      let bGedungId = '';
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(payload.bookingId)) {
          bGedungId = String(rows[i][1]);
          break;
        }
      }
      const gSheet = ss.getSheetByName('Gedung');
      let isBus = false;
      if (gSheet && gSheet.getLastRow() > 1 && bGedungId) {
        const gRows = gSheet.getDataRange().getValues();
        for (let j = 1; j < gRows.length; j++) {
          if (String(gRows[j][0]) === bGedungId && String(gRows[j][3]).trim() === 'Bus Kampus') {
            isBus = true;
            break;
          }
        }
      }
      if (!isBus) {
        return { status: 'error', message: 'Akses ditolak: Admin Bus hanya dapat memproses permohonan kategori Bus Kampus.' };
      }
    }

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(payload.bookingId)) {
        const rowNum = i + 1;

        if (payload.status === 'Disetujui') {
          const reqStart = normalizeDateToIso(rows[i][11]);
          const reqEnd = normalizeDateToIso(rows[i][12]);
          if (checkDateConflict_(rows, rows[i][1], reqStart, reqEnd, payload.bookingId, true)) {
            return { status: 'error', message: 'Tidak dapat menyetujui: tanggal gedung ini bentrok dengan jadwal lain yang sudah disetujui.' };
          }
        }

        let urlSuratBalasan = '';

        if (payload.fileSurat && payload.fileSurat.data) {
          const prefix = payload.status === 'Disetujui' ? 'SURAT_IZIN' : 'SURAT_PENOLAKAN';
          urlSuratBalasan = uploadFileToDrive(payload.fileSurat, `${prefix}_${payload.bookingId}`);
        } else if (payload.autoGenerate && (payload.status === 'Disetujui' || payload.status === 'Ditolak')) {
          urlSuratBalasan = generateOfficialPermissionPDF({
            id: payload.bookingId,
            status: payload.status,
            namaGedung: rows[i][2],
            lokasi: rows[i][3],
            namaPeminjam: rows[i][6],
            instansi: rows[i][7],
            kategoriPeminjam: rows[i][8],
            namaAcara: rows[i][10],
            tglMulai: formatDateSheet(rows[i][11]),
            tglSelesai: formatDateSheet(rows[i][12]),
            tglPengajuan: formatDateSheet(rows[i][18]),
            totalBiaya: rows[i][13],
            catatan: payload.catatan,
            nomorSurat: payload.nomorSurat || '',
            lampiran: payload.lampiran || '-',
            perihal: payload.perihal || '',
            ythTujuan: payload.ythTujuan || '',
            noSuratPemohon: payload.noSuratPemohon || String(rows[i][21] || ''),
            tglSuratPemohon: payload.tglSuratPemohon || '',
            appBaseUrl: payload.appBaseUrl || ''
          });
        }

        // Optimalisasi: Batch update kolom status, surat resmi, dan catatan sekaligus
        const finalUrlBalasan = urlSuratBalasan || rows[i][16] || '';
        sheet.getRange(rowNum, 16, 1, 3).setValues([[
          payload.status,
          finalUrlBalasan,
          payload.catatan || ''
        ]]);

        invalidateAppCache();
        lock.releaseLock(); // Lepas lock secepatnya sebelum panggil WhatsApp API

        const noHpPeminjam = rows[i][9];
        const namaPeminjam = rows[i][6];
        const instansi = rows[i][7];
        const namaGedung = rows[i][2];

        if (noHpPeminjam) {
          const iconStatus = payload.status === 'Disetujui' ? '✅' : '❌';
          const pesan = `${iconStatus} *BALASAN PERMOHONAN GEDUNG UNSRI*\n\n` +
            `Halo *${namaPeminjam}* (${instansi}),\n` +
            `Pengajuan peminjaman gedung *${namaGedung}* telah diproses dengan status: *${payload.status.toUpperCase()}*.\n\n` +
            `• *Catatan:* ${payload.catatan || '-'}\n` +
            (finalUrlBalasan ? `• 📄 *Surat Resmi:* ${finalUrlBalasan}\n\n` : '\n') +
            `*Catatan:* Untuk verifikasi fisik / administrasi lebih lanjut, silakan datang langsung ke Kantor Biro Umum & Perlengkapan UNSRI.`;
          sendFonnteMessage(noHpPeminjam, pesan, null, { tipe: 'Balasan Admin (' + payload.status + ')', pengirim: auth.user.username });
        }

        return { status: 'success', urlSuratBalasan: finalUrlBalasan };
      }
    }
    return { status: 'error', message: 'Data permohonan tidak ditemukan.' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  } finally {
    try { lock.releaseLock(); } catch (eLock) {}
  }
}

/**
 * Pengingat Otomatis H-3 dan H-1 Pemakaian Gedung via WhatsApp
 * Disarankan dijalankan secara terjadwal (Time-driven Trigger harian jam 08.00 pagi)
 */
function sendDailyReminders() {
  const ss = getDbSpreadsheet();
  const sheet = ss.getSheetByName('Booking');
  if (!sheet || sheet.getLastRow() < 2) return;

  const today = new Date();

  // H-1 (Besok)
  const dH1 = new Date();
  dH1.setDate(today.getDate() + 1);
  const h1Str = Utilities.formatDate(dH1, 'Asia/Jakarta', 'dd-MM-yyyy');

  // H-3 (3 hari ke depan)
  const dH3 = new Date();
  dH3.setDate(today.getDate() + 3);
  const h3Str = Utilities.formatDate(dH3, 'Asia/Jakarta', 'dd-MM-yyyy');

  // Pastikan header kolom H3_Notified tersedia di kolom 21
  if (sheet.getLastColumn() < 21) {
    sheet.getRange(1, 21).setValue('H3_Notified');
  }

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const bookingId = rows[i][0];
    const namaGedung = rows[i][2];
    const namaPeminjam = rows[i][6];
    const instansi = rows[i][7] || '';
    const noHp = rows[i][9];
    const namaAcara = rows[i][10];
    const tglMulai = formatDateSheet(rows[i][11]);
    const status = rows[i][15];
    const h1Notified = rows[i][19];
    const h3Notified = rows[i][20];

    if (status === 'Disetujui' && noHp) {
      // 1. Notifikasi H-3
      if (tglMulai === h3Str && h3Notified !== 'YES') {
        const pesanH3 = `🔔 *PENGINGAT H-3 PEMAKAIAN GEDUNG UNSRI*\n\n` +
          `Halo *${namaPeminjam}* (${instansi}),\n` +
          `Mengingatkan bahwa jadwal kegiatan Anda akan berlangsung dalam 3 hari lagi:\n\n` +
          `• *ID Booking:* ${bookingId}\n` +
          `• *Acara:* ${namaAcara}\n` +
          `• *Gedung:* ${namaGedung}\n` +
          `• *Tanggal Mulai:* ${tglMulai}\n\n` +
          `Harap mempersiapkan surat izin masuk kampus, kelistrikan, sound system, serta konfirmasi teknis ke pengelola fasilitas.`;
        sendFonnteMessage(noHp, pesanH3, null, { tipe: 'Pengingat H-3', pengirim: 'Sistem (Trigger)' });
        sheet.getRange(i + 1, 21).setValue('YES');
      }

      // 2. Notifikasi H-1
      if (tglMulai === h1Str && h1Notified !== 'YES') {
        const pesanH1 = `🔔 *PENGINGAT H-1 PEMAKAIAN GEDUNG UNSRI*\n\n` +
          `Halo *${namaPeminjam}* (${instansi}),\n` +
          `Mengingatkan bahwa jadwal kegiatan Anda akan dimulai BESOK:\n\n` +
          `• *ID Booking:* ${bookingId}\n` +
          `• *Acara:* ${namaAcara}\n` +
          `• *Gedung:* ${namaGedung}\n` +
          `• *Mulai:* Besok (${tglMulai})\n\n` +
          `Harap berkoordinasi dengan petugas teknis gedung terkait serah terima kunci dan kelengkapan fasilitas.`;
        sendFonnteMessage(noHp, pesanH1, null, { tipe: 'Pengingat H-1', pengirim: 'Sistem (Trigger)' });
        sheet.getRange(i + 1, 20).setValue('YES');
      }
    }
  }
}

// Alias untuk kompatibilitas trigger lama
function sendHMinus1Reminders() {
  sendDailyReminders();
}

function saveMasterGedung(dataGedung, isEdit, authToken) {
  try {
    const token = authToken || (dataGedung && dataGedung._token);
    const auth = authenticateRequest(token, ['Admin', 'Super Admin', 'Admin Bus', 'Admin Input', 'Petugas Input', 'Operator']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }

    // Restriksi Admin Bus: Hanya boleh mengelola kategori Bus Kampus
    if (auth.user.role === 'Admin Bus') {
      if (String(dataGedung.kategori || '').trim() !== 'Bus Kampus') {
        return { status: 'error', message: 'Akses ditolak: Admin Bus hanya dapat mengelola armada/fasilitas kategori Bus Kampus.' };
      }
    }

    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Gedung');
    const kapasitas = Math.max(0, Number(dataGedung.kapasitas) || 0);
    const tarifUmum = Math.max(0, Number(dataGedung.tarifUmum) || 0);
    const tarifInternal = Math.max(0, Number(dataGedung.tarifInternal) || 0);

    // 1. Simpan foto ke Google Drive jika ada file baru diunggah dari komputer
    let gambarUrl = (dataGedung.gambar || '').trim();
    if (dataGedung.fotoFile && dataGedung.fotoFile.data) {
      const driveUrl = uploadFotoGedungToDrive(dataGedung.fotoFile, dataGedung.id);
      if (!driveUrl) {
        throw new Error('Gagal mengunggah foto ke Google Drive. Periksa izin akses Drive Anda.');
      }
      gambarUrl = driveUrl;
    } else if (gambarUrl) {
      // Normalisasi jika user memasukkan link Google Drive biasa agar menjadi format direct thumbnail
      const driveId = extractDriveFileId(gambarUrl);
      if (driveId && !gambarUrl.includes('thumbnail') && !gambarUrl.includes('lh3.googleusercontent.com/d/')) {
        gambarUrl = 'https://drive.google.com/thumbnail?id=' + driveId + '&sz=w1200';
      }
    }

    if (isEdit && sheet.getLastRow() > 1) {
      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(dataGedung.id)) {
          // Jika edit tapi tidak mengupload foto baru dan field gambar kosong, pertahankan foto lama
          const finalGambar = gambarUrl || String(rows[i][8] || '');
          sheet.getRange(i + 1, 2, 1, 9).setValues([[
            dataGedung.nama, dataGedung.lokasi, dataGedung.kategori, kapasitas,
            tarifUmum, tarifInternal, dataGedung.fasilitas,
            finalGambar, dataGedung.status
          ]]);
          invalidateAppCache();
          return { status: 'success', id: dataGedung.id, gambarUrl: finalGambar };
        }
      }
    }

    sheet.appendRow([
      dataGedung.id, dataGedung.nama, dataGedung.lokasi, dataGedung.kategori,
      kapasitas, tarifUmum, tarifInternal,
      dataGedung.fasilitas, gambarUrl, dataGedung.status
    ]);
    invalidateAppCache();
    return { status: 'success', id: dataGedung.id, gambarUrl: gambarUrl };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

function deleteMasterGedung(gedungId, authToken) {
  try {
    const auth = authenticateRequest(authToken, ['Admin', 'Super Admin', 'Admin Bus', 'Admin Input', 'Petugas Input', 'Operator']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }

    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Gedung');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(gedungId)) {
        if (auth.user.role === 'Admin Bus' && String(rows[i][3] || '').trim() !== 'Bus Kampus') {
          return { status: 'error', message: 'Akses ditolak: Admin Bus hanya dapat menghapus armada Bus Kampus.' };
        }
        sheet.deleteRow(i + 1);
        invalidateAppCache();
        return { status: 'success', id: gedungId };
      }
    }
    return { status: 'error', message: 'Gedung tidak ditemukan.' };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

/**
 * ============================================================================
 * MODUL KHUSUS SUPER ADMIN: MANAJEMEN PENGGUNA & RESET PASSWORD MANUAL
 * ============================================================================
 */

function getAllUsers(authToken) {
  try {
    const auth = authenticateRequest(authToken, ['Super Admin']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }
    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Users');
    if (!sheet || sheet.getLastRow() < 2) {
      return { status: 'success', users: [] };
    }
    const rows = sheet.getDataRange().getValues();
    const list = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (r[0] || r[1]) {
        list.push({
          id: String(r[0] || ''),
          username: String(r[1] || ''),
          nama: String(r[3] || ''),
          kategori: String(r[4] || ''),
          instansi: String(r[5] || ''),
          noHp: String(r[6] || ''),
          role: String(r[7] || 'Penyewa')
        });
      }
    }
    return { status: 'success', users: list };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function createUserBySuperAdmin(payload, authToken) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const auth = authenticateRequest(authToken, ['Super Admin']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }
    if (!payload || !payload.username || !payload.password || !payload.nama) {
      return { status: 'error', message: 'Username, password, dan nama lengkap wajib diisi.' };
    }
    const reqUsername = String(payload.username).trim().toLowerCase();
    if (reqUsername.length < 3) {
      return { status: 'error', message: 'Username minimal 3 karakter.' };
    }
    if (String(payload.password).length < 5) {
      return { status: 'error', message: 'Password minimal 5 karakter.' };
    }

    const allowedRoles = ['Super Admin', 'Admin', 'Admin Bus', 'Admin Input', 'Petugas Input', 'Operator', 'Penyewa'];
    let role = String(payload.role || '').trim();
    if (!allowedRoles.includes(role)) {
      if (/admin\s*input|petugas\s*input|operator/i.test(role)) {
        role = 'Admin Input';
      } else {
        role = 'Penyewa';
      }
    }

    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Users');
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][1] || '').trim().toLowerCase() === reqUsername) {
        return { status: 'error', message: 'Username "' + reqUsername + '" sudah digunakan. Silakan gunakan username lain.' };
      }
    }

    const newId = 'USR-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyMMddHHmmss');
    const token = Utilities.getUuid();
    const pwdHash = hashPassword(payload.password);

    sheet.appendRow([
      newId,
      reqUsername,
      pwdHash,
      String(payload.nama).trim(),
      String(payload.kategori || role).trim(),
      String(payload.instansi || '').trim(),
      String(payload.noHp || '').trim(),
      role,
      token
    ]);

    invalidateAppCache();
    return {
      status: 'success',
      message: 'Pengguna ' + reqUsername + ' (' + role + ') berhasil dibuat.',
      user: {
        id: newId,
        username: reqUsername,
        nama: String(payload.nama).trim(),
        kategori: String(payload.kategori || role).trim(),
        instansi: String(payload.instansi || '').trim(),
        noHp: String(payload.noHp || '').trim(),
        role: role
      }
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function resetPasswordUserBySuperAdmin(payload, authToken) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const auth = authenticateRequest(authToken, ['Super Admin']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }
    if (!payload || !payload.userId || !payload.newPassword) {
      return { status: 'error', message: 'ID pengguna dan password baru wajib diisi.' };
    }
    if (String(payload.newPassword).length < 5) {
      return { status: 'error', message: 'Password baru minimal 5 karakter.' };
    }

    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Users');
    const rows = sheet.getDataRange().getValues();
    let targetRow = -1;
    let targetUsername = '';
    let oldToken = '';

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(payload.userId) || String(rows[i][1]).toLowerCase() === String(payload.userId).toLowerCase()) {
        targetRow = i + 1;
        targetUsername = String(rows[i][1]);
        oldToken = String(rows[i][8] || '').trim();
        break;
      }
    }

    if (targetRow === -1) {
      return { status: 'error', message: 'Pengguna tidak ditemukan.' };
    }

    if (oldToken) invalidateUserSessionCache(oldToken);
    const newHash = hashPassword(payload.newPassword);
    const newToken = Utilities.getUuid();
    sheet.getRange(targetRow, 3).setValue(newHash);
    sheet.getRange(targetRow, 9).setValue(newToken);

    invalidateAppCache();
    return {
      status: 'success',
      message: 'Password untuk pengguna "' + targetUsername + '" berhasil direset secara manual.'
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function deleteUserBySuperAdmin(userId, authToken) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const auth = authenticateRequest(authToken, ['Super Admin']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }
    if (!userId) {
      return { status: 'error', message: 'ID pengguna tidak valid.' };
    }

    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Users');
    const rows = sheet.getDataRange().getValues();
    let targetRow = -1;
    let targetUsername = '';
    let oldToken = '';

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(userId)) {
        targetRow = i + 1;
        targetUsername = String(rows[i][1]);
        oldToken = String(rows[i][8] || '').trim();
        break;
      }
    }

    if (targetRow === -1) {
      return { status: 'error', message: 'Pengguna tidak ditemukan.' };
    }

    if (targetUsername.toLowerCase() === 'superadmin' || targetUsername.toLowerCase() === auth.user.username.toLowerCase()) {
      return { status: 'error', message: 'Akun Super Admin utama tidak boleh dihapus.' };
    }

    if (oldToken) invalidateUserSessionCache(oldToken);
    sheet.deleteRow(targetRow);
    invalidateAppCache();
    return { status: 'success', message: 'Pengguna "' + targetUsername + '" berhasil dihapus.' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ============================================================================
 * MODUL LOG AKTIVITAS: LOG LOGIN USER (SUPER ADMIN) & HISTORY WA (ADMIN/SUPER ADMIN)
 * ============================================================================
 */

function getLoginLogs(authToken) {
  try {
    const auth = authenticateRequest(authToken, ['Super Admin']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }
    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Log_Login');
    if (!sheet || sheet.getLastRow() < 2) {
      return { status: 'success', logs: [] };
    }
    const rows = sheet.getDataRange().getValues();
    const list = [];
    const maxRows = 300;
    for (let i = rows.length - 1; i >= 1 && list.length < maxRows; i--) {
      const r = rows[i];
      if (r[0] || r[3]) {
        const waktuVal = r[1] instanceof Date
          ? Utilities.formatDate(r[1], 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
          : String(r[1] || '');
        list.push({
          id: String(r[0] || ''),
          waktu: waktuVal,
          userId: String(r[2] || ''),
          username: String(r[3] || ''),
          nama: String(r[4] || ''),
          role: String(r[5] || ''),
          status: String(r[6] || ''),
          keterangan: String(r[7] || '')
        });
      }
    }
    return { status: 'success', logs: list };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function getWaLogs(authToken) {
  try {
    const auth = authenticateRequest(authToken, ['Admin', 'Super Admin']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }
    const ss = getDbSpreadsheet();
    const sheet = ss.getSheetByName('Log_WA');
    if (!sheet || sheet.getLastRow() < 2) {
      return { status: 'success', logs: [] };
    }
    const rows = sheet.getDataRange().getValues();
    const list = [];
    const maxRows = 300;
    for (let i = rows.length - 1; i >= 1 && list.length < maxRows; i--) {
      const r = rows[i];
      if (r[0] || r[2]) {
        const waktuVal = r[1] instanceof Date
          ? Utilities.formatDate(r[1], 'Asia/Jakarta', 'dd-MM-yyyy HH:mm:ss')
          : String(r[1] || '');
        list.push({
          id: String(r[0] || ''),
          waktu: waktuVal,
          tujuan: String(r[2] || ''),
          tipe: String(r[3] || ''),
          pesan: String(r[4] || ''),
          status: String(r[5] || ''),
          respon: String(r[6] || ''),
          pengirim: String(r[7] || '')
        });
      }
    }
    return { status: 'success', logs: list };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/**
 * Helper: Normalisasi tanggal ke format ISO YYYY-MM-DD untuk perbandingan logis
 */
function normalizeDateToIso(dVal) {
  if (!dVal) return '';
  if (dVal instanceof Date) return Utilities.formatDate(dVal, 'Asia/Jakarta', 'yyyy-MM-dd');
  const s = String(dVal).trim();
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const parts = s.split('-');
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    return s.substring(0, 10);
  }
  return s;
}

/**
 * Format tanggal ke mode dd-mm-yyyy untuk tampilan dan database
 */
function formatDateSheet(val) {
  if (!val) return '';
  if (val instanceof Date) return Utilities.formatDate(val, 'Asia/Jakarta', 'dd-MM-yyyy');
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const p = str.substring(0, 10).split('-');
    return `${p[2]}-${p[1]}-${p[0]}`;
  }
  return str;
}