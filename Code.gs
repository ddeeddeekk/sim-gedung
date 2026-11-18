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
      'Status_Booking', 'URL_Surat_Balasan', 'Catatan_Admin', 'Tanggal_Pengajuan', 'H1_Notified', 'H3_Notified'
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
 * Generate Surat Izin Pemakaian Gedung Otomatis Berformat PDF (dengan QR HMAC)
 */
function generateOfficialPermissionPDF(bookingData) {
  try {
    const folder = getOrCreateArsipFolder();
    if (!folder) return '';

    let appUrl = 'https://script.google.com';
    if (bookingData.appBaseUrl && /^https?:\/\//i.test(String(bookingData.appBaseUrl))) {
      appUrl = String(bookingData.appBaseUrl).split('?')[0].split('#')[0];
    } else {
      try {
        appUrl = ScriptApp.getService().getUrl() || appUrl;
      } catch (eUrl) {}
    }
    const sig = computeBookingHmac(bookingData.id);
    const sep = appUrl.indexOf('?') > -1 ? '&' : '?';
    const qrData = encodeURIComponent(`${appUrl}${sep}verify=${encodeURIComponent(bookingData.id)}&sig=${sig}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${qrData}`;

    const biayaText = Number(bookingData.totalBiaya) === 0
      ? 'Gratis / Disubsidi Universitas'
      : 'Tarif Terjadwal: Rp ' + Number(bookingData.totalBiaya).toLocaleString('id-ID');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Times New Roman', Times, serif; padding: 25px; line-height: 1.5; color: #111; }
          .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 20px; }
          .header h2 { margin: 0; font-size: 15pt; text-transform: uppercase; letter-spacing: 1px; }
          .header h3 { margin: 3px 0; font-size: 13pt; }
          .header p { margin: 2px 0; font-size: 9pt; font-style: italic; }
          .title { text-align: center; margin-bottom: 20px; }
          .title h4 { margin: 0; text-decoration: underline; font-size: 13pt; text-transform: uppercase; }
          .title span { font-size: 10pt; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 20px; font-size: 10.5pt; }
          td { padding: 5px 4px; vertical-align: top; }
          .bold { font-weight: bold; }
          .footer { margin-top: 30px; width: 100%; }
          .signature-box { float: right; width: 260px; text-align: center; font-size: 10.5pt; }
          .qr-box { float: left; width: 160px; text-align: center; font-size: 9pt; }
          .clear { clear: both; }
          .notice { font-size: 9pt; border-left: 3px solid #081226; background: #f5f5f5; padding: 8px 12px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>KEMENTERIAN PENDIDIKAN TINGGI, SAINS, DAN TEKNOLOGI</h2>
          <h3>UNIVERSITAS SRIWIJAYA</h3>
          <p>BIRO UMUM DAN KEUANGAN - BAGIAN PENGELOLAAN FASILITAS</p>
          <p>Jl. Raya Palembang - Prabumulih Km. 32 Indralaya, Ogan Ilir 30662</p>
        </div>

        <div class="title">
          <h4>SURAT IZIN PENGGUNAAN FASILITAS / GEDUNG</h4>
          <span>Nomor: ${escapeHtml_(bookingData.nomorSurat || 'UN9/BUK/HM/' + new Date().getFullYear())}</span>
        </div>

        <p>Berdasarkan permohonan yang diajukan, Rektorat Universitas Sriwijaya memberikan izin pemakaian fasilitas dengan ketentuan:</p>

        <table>
          <tr><td width="30%"><strong>ID Booking</strong></td><td width="3%">:</td><td>${escapeHtml_(bookingData.id)}</td></tr>
          <tr><td><strong>Nama Gedung / Ruang</strong></td><td>:</td><td class="bold">${escapeHtml_(bookingData.namaGedung)} (${escapeHtml_(bookingData.lokasi)})</td></tr>
          <tr><td><strong>Nama Penanggung Jawab</strong></td><td>:</td><td>${escapeHtml_(bookingData.namaPeminjam)}</td></tr>
          <tr><td><strong>Instansi / Ormawa</strong></td><td>:</td><td>${escapeHtml_(bookingData.instansi)} (${escapeHtml_(bookingData.kategoriPeminjam)})</td></tr>
          <tr><td><strong>Nama Kegiatan / Acara</strong></td><td>:</td><td>${escapeHtml_(bookingData.namaAcara)}</td></tr>
          <tr><td><strong>Jadwal Pelaksanaan</strong></td><td>:</td><td class="bold">${escapeHtml_(bookingData.tglMulai)} s/d ${escapeHtml_(bookingData.tglSelesai)}</td></tr>
          <tr><td><strong>Status Biaya</strong></td><td>:</td><td>${escapeHtml_(biayaText)}</td></tr>
          <tr><td><strong>Catatan / Arahan</strong></td><td>:</td><td>${escapeHtml_(bookingData.catatan || 'Wajib mematuhi ketertiban dan menjaga kebersihan fasilitas.')}</td></tr>
        </table>

        <div class="notice">
          <strong>Pemberitahuan:</strong> Pemohon wajib membawa cetakan surat izin ini saat melapor ke kantor Pengelola Gedung selambat-lambatnya H-1 pelaksanaan acara.
        </div>

        <div class="footer">
          <div class="qr-box">
            <img src="${qrUrl}" width="95" height="95" /><br>
            <span>Pindai verifikasi keaslian</span>
          </div>
          <div class="signature-box">
            <p>Indralaya, ${Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd MMMM yyyy')}</p>
            <p>A.n. Rektor Universitas Sriwijaya<br>Kepala Bagian Umum & Perlengkapan,</p>
            <br><br><br>
            <p><strong><u>Bagian Sarana & Prasarana</u></strong><br>NIP. 197805122003121002</p>
          </div>
          <div class="clear"></div>
        </div>
      </body>
      </html>
    `;

    const blob = HtmlService.createHtmlOutput(htmlContent).getAs('application/pdf');
    blob.setName(`SURAT_IZIN_RESMI_${String(bookingData.id).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
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
      tglPengajuan: b.tglPengajuan
    };
  });

  const cfg = getFonnteConfig();
  return {
    status: 'success',
    spreadsheetName: rawPayload.spreadsheetName,
    spreadsheetUrl: isSuper || isGeneralAdmin ? rawPayload.spreadsheetUrl : '',
    gedung: rawGedung,
    booking: filteredBookings,
    fonnteConfig: isSuper ? cfg : { token: '', adminWa: '', isActive: cfg.isActive }
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
            tglPengajuan: formatDateSheet(r[18])
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

    for (let i = 1; i < allUsers.length; i++) {
      const row = allUsers[i];
      const uName = String(row[1]).trim().toLowerCase();
      const storedHash = String(row[2]).trim();

      if (uName === targetUser && verifyPassword_(password, storedHash)) {
        // Migrasi otomatis hash legacy (tanpa salt) ke salted hash
        if (storedHash.indexOf('sha256$') !== 0) {
          sheet.getRange(i + 1, 3).setValue(hashPassword(password));
        }
        const token = Utilities.getUuid();
        sheet.getRange(i + 1, 9).setValue(token);
        return {
          status: 'success',
          user: {
            id: String(row[0]),
            username: String(row[1]),
            nama: String(row[3]),
            kategori: String(row[4]),
            instansi: String(row[5]),
            noHp: String(row[6]),
            role: String(row[7]),
            token: token
          }
        };
      }
    }

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

function saveFonnteConfig(newCfg) {
  try {
    const auth = authenticateRequest(newCfg && newCfg._token, ['Super Admin']);
    if (!auth.authorized) {
      return { status: 'error', authError: !auth.forbidden, message: auth.message };
    }
    const ss = getDbSpreadsheet();
    let sheet = ss.getSheetByName('Pengaturan');
    if (!sheet) sheet = ss.insertSheet('Pengaturan');
    sheet.clear();
    // Optimalisasi: Batch write sekaligus 4 baris data konfigurasi
    const configRows = [
      ['Key', 'Value'],
      ['FONNTE_TOKEN', (newCfg.token || '').trim()],
      ['ADMIN_WA', (newCfg.adminWa || '').trim()],
      ['WA_ACTIVE', newCfg.isActive ? 'TRUE' : 'FALSE']
    ];
    sheet.getRange(1, 1, 4, 2).setValues(configRows);
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
  return sendFonnteMessage(targetWa, pesan, token);
}

function sendFonnteMessage(targetPhone, messageText, overrideToken) {
  try {
    const cfg = getFonnteConfig();
    const token = overrideToken ? overrideToken.trim() : cfg.token;
    if (!token) return { status: 'error', message: 'Token Fonnte belum diatur.' };
    if (!overrideToken && !cfg.isActive) return { status: 'skipped', message: 'Notifikasi WA dinonaktifkan di pengaturan.' };

    const cleanPhone = String(targetPhone).replace(/\D/g, '');
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

    const result = JSON.parse(response.getContentText());
    return result.status ? { status: 'success' } : { status: 'error', message: result.reason || 'Gagal mengirim pesan via Fonnte.' };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function sendRegistrationOtpWA(noHp, nama) {
  try {
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
    return sendFonnteMessage(cleanPhone, pesanOtp);
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

    sheet.appendRow([
      bookingId, gedungInfo.id, gedungInfo.nama, gedungInfo.lokasi, auth.user.id,
      auth.user.username, auth.user.nama, String(payload.instansi || auth.user.instansi || '').trim(),
      String(payload.kategoriPeminjam || 'Umum'), String(payload.noHp || auth.user.noHp || '').trim(),
      String(payload.namaAcara || '').trim(), tglMulaiDisp, tglSelesaiDisp, gedungInfo.totalBiaya,
      urlSurat, 'Menunggu Verifikasi', '', '', tglPengajuan, 'NO', 'NO'
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
      sendFonnteMessage(cfg.adminWa, pesan);
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

    lock.waitLock(15000);
    const ss = getDbSpreadsheet();
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

    if (payload.status === 'Disetujui') {
      urlBalasan = generateOfficialPermissionPDF({
        id: bookingId,
        namaGedung: payload.namaGedung,
        lokasi: payload.lokasi,
        namaPeminjam: payload.namaPeminjam,
        instansi: payload.instansi,
        kategoriPeminjam: payload.kategoriPeminjam,
        namaAcara: payload.namaAcara,
        tglMulai: formatDateSheet(reqStart),
        tglSelesai: formatDateSheet(reqEnd),
        totalBiaya: Number(payload.totalBiaya) || 0,
        catatan: payload.catatanAdmin,
        appBaseUrl: payload.appBaseUrl || ''
      });
    }

    sheet.appendRow([
      bookingId, payload.gedungId, payload.namaGedung, payload.lokasi, auth.user.id,
      auth.user.username, payload.namaPeminjam, payload.instansi, payload.kategoriPeminjam,
      payload.noHp, payload.namaAcara, formatDateSheet(reqStart), formatDateSheet(reqEnd), Number(payload.totalBiaya) || 0,
      urlSurat, payload.status, urlBalasan, payload.catatanAdmin, tglPengajuan, 'NO', 'NO'
    ]);

    invalidateAppCache();
    lock.releaseLock();

    // Notifikasi WhatsApp dikirimkan di luar lock
    if (payload.noHp) {
      const pesan = `🏛️ *KONFIRMASI JADWAL GEDUNG UNSRI*\n\n` +
        `Halo *${payload.namaPeminjam}* (${payload.instansi}),\n` +
        `Jadwal peminjaman gedung Anda telah dicatat oleh Admin SIM-GEDUNG UNSRI:\n\n` +
        `• *ID:* ${bookingId}\n` +
        `• *Gedung:* ${payload.namaGedung}\n` +
        `• *Acara:* ${payload.namaAcara}\n` +
        `• *Tanggal:* ${formatDateSheet(reqStart)} s/d ${formatDateSheet(reqEnd)}\n` +
        `• *Status:* *${payload.status.toUpperCase()}*\n\n` +
        (urlBalasan ? `📄 *Surat Izin Resmi:* ${urlBalasan}\n\n` : '') +
        `Silakan ambil fisik surat atau konfirmasi ke Bagian Umum & Perlengkapan.`;
      sendFonnteMessage(payload.noHp, pesan);
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
        } else if (payload.autoGenerate && payload.status === 'Disetujui') {
          urlSuratBalasan = generateOfficialPermissionPDF({
            id: payload.bookingId,
            namaGedung: rows[i][2],
            lokasi: rows[i][3],
            namaPeminjam: rows[i][6],
            instansi: rows[i][7],
            kategoriPeminjam: rows[i][8],
            namaAcara: rows[i][10],
            tglMulai: formatDateSheet(rows[i][11]),
            tglSelesai: formatDateSheet(rows[i][12]),
            totalBiaya: rows[i][13],
            catatan: payload.catatan,
            nomorSurat: payload.nomorSurat || '',
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
          sendFonnteMessage(noHpPeminjam, pesan);
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
        sendFonnteMessage(noHp, pesanH3);
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
        sendFonnteMessage(noHp, pesanH1);
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

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(payload.userId) || String(rows[i][1]).toLowerCase() === String(payload.userId).toLowerCase()) {
        targetRow = i + 1;
        targetUsername = String(rows[i][1]);
        break;
      }
    }

    if (targetRow === -1) {
      return { status: 'error', message: 'Pengguna tidak ditemukan.' };
    }

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

    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(userId)) {
        targetRow = i + 1;
        targetUsername = String(rows[i][1]);
        break;
      }
    }

    if (targetRow === -1) {
      return { status: 'error', message: 'Pengguna tidak ditemukan.' };
    }

    if (targetUsername.toLowerCase() === 'superadmin' || targetUsername.toLowerCase() === auth.user.username.toLowerCase()) {
      return { status: 'error', message: 'Akun Super Admin utama tidak boleh dihapus.' };
    }

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