let globalPayments = [];
let currentTab = 'all';

document.addEventListener("DOMContentLoaded", async () => {
  // Yetki
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);
  if (user.rol !== "Owner") {
    window.location.href = "../index.html";
    return;
  }

  // URL'den tab parametresini kontrol et
  const urlParams = new URLSearchParams(window.location.search);
  const tab = urlParams.get('tab');
  if (tab === 'late') {
    currentTab = 'late';
    switchTab('late');
  }
  
  loadPayments(user.kullaniciID);
  loadMethods(); // Ödeme yöntemleri
  loadContracts(user.kullaniciID); // Sözleşmeleri yükle (Yeni Ekleme için)
  loadBanks(); // Bankaları yükle
});

// Tab Değiştir
window.switchTab = function(tab) {
  currentTab = tab;
  const user = JSON.parse(localStorage.getItem("user"));
  
  // Tab butonlarını güncelle
  document.getElementById("tabAll").style.background = tab === 'all' ? 'linear-gradient(to right, #00c6ff, #0072ff)' : 'rgba(255,255,255,0.1)';
  document.getElementById("tabAll").style.color = tab === 'all' ? '#fff' : '#ccc';
  document.getElementById("tabLate").style.background = tab === 'late' ? 'rgba(255,75,92,0.2)' : 'rgba(255,255,255,0.1)';
  document.getElementById("tabLate").style.color = tab === 'late' ? '#ff4b5c' : '#ccc';
  
  loadPayments(user.kullaniciID);
};

// Ödemeleri Listele
async function loadPayments(ownerId) {
  const tableBody = document.getElementById("paymentList");
  tableBody.innerHTML =
    "<tr><td colspan='6' style='text-align:center;'>Yükleniyor...</td></tr>";

    try {
      let payments;
      if (currentTab === 'late') {
        // Geciken ödemeler: Backend'den tüm ödemeleri al, frontend'de filtrele
        payments = await API.get(`/KiraOdeme/owner/${ownerId}`);
        
        // Frontend'de tarih kontrolü ile geciken ödemeleri filtrele
        if (payments && payments.length > 0) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          payments = payments.filter(p => {
            const vadeTarihi = p.vadeTarihi || p.VadeTarihi;
            const odemeTarihi = p.odemeTarihi || p.OdemeTarihi;
            
            // Ödeme tarihi varsa gecikmiş değil
            if (odemeTarihi && odemeTarihi.trim() !== "" && odemeTarihi !== "null") {
              return false;
            }
            
            // Vade tarihi geçmişse gecikmiş
            if (vadeTarihi) {
              const vadeDate = new Date(vadeTarihi);
              vadeDate.setHours(0, 0, 0, 0);
              return vadeDate < today;
            }
            
            return false;
          });
        }
      } else {
        payments = await API.get(`/KiraOdeme/owner/${ownerId}`);
      }
      
      globalPayments = payments || [];
      
      // Durum sıralaması: Late → Pending → Paid (Frontend'de hesaplanan durum)
      globalPayments.sort((a, b) => {
        // Frontend'de durumu hesapla
        const statusA = calculatePaymentStatus(a.vadeTarihi || a.VadeTarihi, a.odemeTarihi || a.OdemeTarihi);
        const statusB = calculatePaymentStatus(b.vadeTarihi || b.VadeTarihi, b.odemeTarihi || b.OdemeTarihi);
        
        const durumA = statusA.status;
        const durumB = statusB.status;
        
        // Öncelik sırası: Late (0), Pending (1), Paid (2)
        const priority = { "Late": 0, "Pending": 1, "Paid": 2 };
        const priorityA = priority[durumA] !== undefined ? priority[durumA] : 3;
        const priorityB = priority[durumB] !== undefined ? priority[durumB] : 3;
        
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }
        
        // Aynı durumdaysa vade tarihine göre sırala
        const vadeA = new Date(a.vadeTarihi || a.VadeTarihi || 0);
        const vadeB = new Date(b.vadeTarihi || b.VadeTarihi || 0);
        return vadeA - vadeB;
      });
    
    tableBody.innerHTML = "";

    if (globalPayments.length > 0) {
      globalPayments.forEach((p) => {
        const id = p.kiraOdemeID || p.KiraOdemeID;
        const vade = p.vadeTarihi || p.VadeTarihi;
        const tutar = p.tutar || p.Tutar;
        const para = p.paraBirimi || p.ParaBirimi || "TL";
        const odemeTarihi = p.odemeTarihi || p.OdemeTarihi;
        const mulk = p.mulk || p.MulkBaslik || p.Mulk;
        const kiraci = p.kiraci || p.KiraciAd || p.Kiraci;

        // Ödeme durumunu tarih kontrolü ile hesapla (Backend'den gelen durum yerine)
        const calculatedStatus = calculatePaymentStatus(vade, odemeTarihi);
        const durum = calculatedStatus.status;
        const statusClass = calculatedStatus.class;
        const statusText = calculatedStatus.text;

        const row = `
                    <tr>
                        <td>${formatDate(vade)}</td>
                        <td>
                            <div style="font-weight:600;">${mulk}</div>
                            <div style="font-size:0.8rem; color:#8d97ad;">${kiraci}</div>
                        </td>
                        <td><span class="amount-text">${parseFloat(tutar).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${para}</span></td>
                        <td><span class="payment-status ${statusClass}">${statusText}</span></td>
                        <td>${formatDate(odemeTarihi)}</td>
                        <td style="white-space:nowrap;">
                            ${
                              durum !== "Paid"
                                ? `<button class="btn-pay" onclick="openPayModal(${id})" style="margin-right:5px;"><i class="fa-solid fa-check"></i> Tahsil Et</button>`
                                : '<i class="fa-solid fa-check-circle" style="color:#00c853; font-size:1.2rem;"></i>'
                            }
                            ${durum !== "Paid" ? `<button class="action-btn btn-edit" onclick="editPayment(${id})" title="Düzenle" style="margin-right:5px;"><i class="fa-solid fa-pen"></i></button>` : ''}
                            ${durum !== "Paid" ? `<button class="action-btn btn-delete" onclick="deletePayment(${id})" title="Sil"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </td>
                    </tr>
                `;
        tableBody.innerHTML += row;
      });
    } else {
      tableBody.innerHTML =
        "<tr><td colspan='6' style='text-align:center; padding:2rem; color:#888;'>Kayıt bulunamadı.</td></tr>";
    }
  } catch (err) {
    console.error(err);
    tableBody.innerHTML =
      "<tr><td colspan='6' style='color:red; text-align:center;'>Hata oluştu.</td></tr>";
  }
}

// --- MODAL YÖNETİMİ ---

// Tahsilat Modalını Aç
window.openPayModal = function (id) {
  const payment = globalPayments.find(
    (p) => (p.kiraOdemeID || p.KiraOdemeID) == id
  );
  if (!payment) return;

  document.getElementById("payId").value = id;
  document.getElementById("payAmount").value = payment.tutar || payment.Tutar;
  document.getElementById("payDesc").value = "";
  document.getElementById("payModalText").innerHTML = `<strong>${
    payment.mulk || payment.MulkBaslik
  }</strong> için ödeme alınıyor.`;

  document.getElementById("payModal").style.display = "flex";
};

// Yeni Ödeme Modalını Aç
window.openAddModal = function () {
  document.getElementById("paymentFormTitle").innerText = "Yeni Ödeme Planı Ekle";
  document.getElementById("addPaymentForm").reset();
  document.getElementById("editPaymentId").value = "";
  document.getElementById("paymentFormError").style.display = "none";
  document.getElementById("addModal").style.display = "flex";
};

// Tüm Modalları Kapat
window.closeModals = function () {
  document.getElementById("payModal").style.display = "none";
  document.getElementById("addModal").style.display = "none";
  document.getElementById("bankAccountModal").style.display = "none";
  document.getElementById("addBankAccountModal").style.display = "none";
  document.getElementById("deactivateAccountModal").style.display = "none";
  document.getElementById("deletePaymentModal").style.display = "none";
  
  // Formları temizle
  document.getElementById("addBankAccountForm")?.reset();
  document.getElementById("editBankAccountId").value = "";
  document.getElementById("addPaymentForm")?.reset();
  document.getElementById("editPaymentId").value = "";
  accountToDeactivate = null;
  paymentToDelete = null;
};

// Banka Hesabı Modalını Aç
window.openBankAccountModal = async function() {
  document.getElementById("bankAccountModal").style.display = "flex";
  await loadBankAccounts();
};

// Banka Hesabı Ekle Modalını Aç
window.openAddBankAccountModal = function() {
  document.getElementById("bankAccountFormTitle").innerText = "Yeni Banka Hesabı Ekle";
  document.getElementById("addBankAccountForm").reset();
  document.getElementById("editBankAccountId").value = "";
  document.getElementById("aktifMiCheck").checked = true;
  
  // Hata mesajlarını temizle
  document.getElementById("bankAccountFormError").style.display = "none";
  document.getElementById("bankSelectError").style.display = "none";
  document.getElementById("ibanError").style.display = "none";
  
  document.getElementById("addBankAccountModal").style.display = "flex";
};

// Bankaları Yükle
async function loadBanks() {
  try {
    const banks = await API.get("/Banka");
    const select = document.getElementById("bankSelect");
    select.innerHTML = '<option value="">Seçiniz...</option>';
    
    if (banks && banks.length > 0) {
      // Alfabetik sırala (Türkçe karakter desteği)
      const sortedBanks = banks.sort((a, b) => {
        const nameA = (a.bankaAdi || a.BankaAdi || "").toLowerCase();
        const nameB = (b.bankaAdi || b.BankaAdi || "").toLowerCase();
        return nameA.localeCompare(nameB, "tr");
      });
      
      sortedBanks.forEach(b => {
        const opt = document.createElement("option");
        opt.value = b.bankaID || b.BankaID;
        opt.text = b.bankaAdi || b.BankaAdi;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error("Banka yükleme hatası:", e);
    const select = document.getElementById("bankSelect");
    select.innerHTML = '<option value="">Banka listesi yüklenemedi</option>';
  }
}

// Global değişkenler
let globalBankAccounts = [];
let accountToDeactivate = null;

// Banka Hesaplarını Yükle
async function loadBankAccounts() {
  const loadingEl = document.getElementById("bankAccountLoading");
  const listEl = document.getElementById("bankAccountList");
  const tableBody = document.getElementById("bankAccountTableBody");
  const emptyEl = document.getElementById("bankAccountEmpty");
  const user = JSON.parse(localStorage.getItem("user"));
  
  loadingEl.style.display = "block";
  listEl.style.display = "none";
  emptyEl.style.display = "none";
  
  try {
    const accounts = await API.get(`/BankaHesap/user/${user.kullaniciID}`);
    
    loadingEl.style.display = "none";
    
    if (accounts && accounts.length > 0) {
      // Aktif hesaplar üstte, pasifler altta - AktifMi'ye göre sırala
      globalBankAccounts = accounts.sort((a, b) => {
        const aAktif = a.aktifMi !== undefined ? a.aktifMi : a.AktifMi;
        const bAktif = b.aktifMi !== undefined ? b.aktifMi : b.AktifMi;
        if (aAktif === bAktif) return 0;
        return aAktif ? -1 : 1; // Aktifler önce
      });
      
      tableBody.innerHTML = "";
      
      globalBankAccounts.forEach(acc => {
        const id = acc.bankaHesapID || acc.BankaHesapID;
        const bankaAdi = acc.bankaAdi || acc.BankaAdi || "Bilinmeyen";
        const iban = acc.iban || acc.IBAN || "-";
        const hesapAdi = acc.hesapAdi || acc.HesapAdi || "-";
        const aktifMi = acc.aktifMi !== undefined ? acc.aktifMi : acc.AktifMi;
        
        // Pasif hesaplar için stil
        const rowStyle = aktifMi ? "" : "opacity:0.6; color:#888;";
        const statusClass = aktifMi ? "bg-paid" : "bg-late";
        const statusText = aktifMi ? "Aktif" : "Pasif";
        
        // IBAN'ı formatla (4'er karakter gruplar halinde)
        const formattedIban = iban.length > 4 ? iban.match(/.{1,4}/g)?.join(' ') || iban : iban;
        
        const row = `
          <tr style="${rowStyle}">
            <td style="padding:12px; font-weight:600; ${!aktifMi ? 'color:#888;' : 'color:#fff;'}">${bankaAdi}</td>
            <td style="padding:12px; font-family:monospace; font-size:0.85rem; word-break:break-all; ${!aktifMi ? 'color:#666;' : 'color:#ccc;'}">${formattedIban}</td>
            <td style="padding:12px; ${!aktifMi ? 'color:#666;' : 'color:#8d97ad;'}">${hesapAdi}</td>
            <td style="padding:12px; text-align:center;">
              <span class="payment-status ${statusClass}" style="font-size:0.75rem;">${statusText}</span>
            </td>
            <td style="padding:12px; text-align:right;">
              <button class="action-btn btn-edit" onclick="editBankAccount(${id})" title="Düzenle" style="margin-right:5px; ${!aktifMi ? 'opacity:0.5;' : ''}">
                <i class="fa-solid fa-pen"></i> Düzenle
              </button>
              <button class="action-btn btn-delete" onclick="deactivateBankAccount(${id})" title="Pasife Al" ${!aktifMi ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>
                <i class="fa-solid fa-ban"></i> Pasife Al
              </button>
            </td>
          </tr>
        `;
        tableBody.innerHTML += row;
      });
      
      listEl.style.display = "block";
      emptyEl.style.display = "none";
    } else {
      listEl.style.display = "none";
      emptyEl.style.display = "block";
    }
  } catch (e) {
    console.error("Banka hesabı yükleme hatası:", e);
    loadingEl.style.display = "none";
    showBankAccountMessage("Hesap listesi yüklenirken hata oluştu.", "error");
  }
}

// Banka Hesabı Ekle/Düzenle
document.getElementById("addBankAccountForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Hata mesajlarını temizle
  document.getElementById("bankAccountFormError").style.display = "none";
  document.getElementById("bankSelectError").style.display = "none";
  document.getElementById("ibanError").style.display = "none";
  
  const user = JSON.parse(localStorage.getItem("user"));
  const editId = document.getElementById("editBankAccountId").value;
  const bankaID = document.getElementById("bankSelect").value;
  const iban = document.getElementById("ibanInput").value.trim();
  const hesapAdi = document.getElementById("hesapAdiInput").value.trim();
  const aktifMi = document.getElementById("aktifMiCheck").checked;
  
  // Validation
  if (!bankaID) {
    document.getElementById("bankSelectError").innerText = "Banka seçimi zorunludur.";
    document.getElementById("bankSelectError").style.display = "block";
    return;
  }
  
  if (!iban) {
    document.getElementById("ibanError").innerText = "IBAN zorunludur.";
    document.getElementById("ibanError").style.display = "block";
    return;
  }
  
  // IBAN format kontrolü (basit)
  if (iban.length < 15) {
    document.getElementById("ibanError").innerText = "IBAN geçerli bir formatta olmalıdır.";
    document.getElementById("ibanError").style.display = "block";
    return;
  }
  
  const submitBtn = document.getElementById("bankAccountSubmitBtn");
  const originalText = submitBtn.innerText;
  submitBtn.innerText = "Kaydediliyor...";
  submitBtn.disabled = true;
  
  const data = {
    kullaniciID: user.kullaniciID,
    bankaID: bankaID,
    iban: iban,
    hesapAdi: hesapAdi || null,
    aktifMi: aktifMi
  };
  
  try {
    let result;
    if (editId) {
      // Güncelleme
      result = await API.put(`/BankaHesap/${editId}`, data);
      if (result !== null) {
        showBankAccountMessage("Banka hesabı başarıyla güncellendi.", "success");
        closeModals();
        await loadBankAccounts();
      }
    } else {
      // Yeni Ekleme
      result = await API.post("/BankaHesap", data);
      if (result !== null) {
        showBankAccountMessage("Banka hesabı başarıyla eklendi.", "success");
        closeModals();
        await loadBankAccounts();
      }
    }
  } catch (error) {
    console.error("Banka hesabı kaydetme hatası:", error);
    const errorMsg = error.message || "İşlem başarısız";
    
    // Backend'den gelen hata mesajlarını kontrol et
    if (errorMsg.includes("IBAN") && (errorMsg.includes("zaten") || errorMsg.includes("kayıtlı") || errorMsg.includes("duplicate"))) {
      document.getElementById("ibanError").innerText = "Bu IBAN zaten sistemde kayıtlı.";
      document.getElementById("ibanError").style.display = "block";
    } else if (errorMsg.includes("IBAN") && errorMsg.includes("zorunlu")) {
      document.getElementById("ibanError").innerText = "IBAN zorunludur.";
      document.getElementById("ibanError").style.display = "block";
    } else {
      document.getElementById("bankAccountFormError").innerText = "Hata: " + errorMsg;
      document.getElementById("bankAccountFormError").style.display = "block";
    }
  } finally {
    submitBtn.innerText = originalText;
    submitBtn.disabled = false;
  }
});

// Banka Hesabı Düzenle
window.editBankAccount = function(id) {
  const account = globalBankAccounts.find(acc => (acc.bankaHesapID || acc.BankaHesapID) == id);
  if (!account) {
    showBankAccountMessage("Hesap bulunamadı.", "error");
    return;
  }
  
  document.getElementById("bankAccountFormTitle").innerText = "Banka Hesabı Düzenle";
  document.getElementById("editBankAccountId").value = id;
  document.getElementById("bankSelect").value = account.bankaID || account.BankaID || "";
  document.getElementById("ibanInput").value = account.iban || account.IBAN || "";
  document.getElementById("hesapAdiInput").value = account.hesapAdi || account.HesapAdi || "";
  document.getElementById("aktifMiCheck").checked = account.aktifMi !== undefined ? account.aktifMi : account.AktifMi;
  
  // Hata mesajlarını temizle
  document.getElementById("bankAccountFormError").style.display = "none";
  document.getElementById("bankSelectError").style.display = "none";
  document.getElementById("ibanError").style.display = "none";
  
  document.getElementById("addBankAccountModal").style.display = "flex";
};

// Banka Hesabı Pasife Al
window.deactivateBankAccount = function(id) {
  const account = globalBankAccounts.find(acc => {
    const accId = acc.bankaHesapID || acc.BankaHesapID;
    return accId == id || accId === parseInt(id);
  });
  
  if (!account) {
    showBankAccountMessage("Hesap bulunamadı.", "error");
    return;
  }
  
  // Zaten pasifse uyarı ver
  const aktifMi = account.aktifMi !== undefined ? account.aktifMi : account.AktifMi;
  if (!aktifMi) {
    showBankAccountMessage("Bu hesap zaten pasif durumda.", "error");
    return;
  }
  
  accountToDeactivate = { 
    id: account.bankaHesapID || account.BankaHesapID, 
    iban: account.iban || account.IBAN || "" 
  };
  document.getElementById("deactivateError").style.display = "none";
  document.getElementById("deactivateAccountModal").style.display = "flex";
};

window.closeDeactivateModal = function() {
  document.getElementById("deactivateAccountModal").style.display = "none";
  accountToDeactivate = null;
};

window.confirmDeactivate = async function() {
  if (!accountToDeactivate) {
    document.getElementById("deactivateError").innerText = "Hesap bilgisi bulunamadı.";
    document.getElementById("deactivateError").style.display = "block";
    return;
  }
  
  const deactivateBtn = document.querySelector("#deactivateAccountModal button:last-child");
  if (!deactivateBtn) {
    console.error("Deactivate butonu bulunamadı");
    return;
  }
  
  const originalText = deactivateBtn.innerText;
  deactivateBtn.innerText = "İşleniyor...";
  deactivateBtn.disabled = true;
  
  try {
    // Pasife almak için PUT ile aktifMi=false gönder
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || !user.kullaniciID) {
      throw new Error("Kullanıcı bilgisi bulunamadı. Lütfen tekrar giriş yapın.");
    }
    
    const account = globalBankAccounts.find(acc => (acc.bankaHesapID || acc.BankaHesapID) == accountToDeactivate.id);
    
    if (!account) {
      throw new Error("Hesap bulunamadı. Lütfen sayfayı yenileyin.");
    }
    
    // Tüm gerekli alanları kontrol et
    const bankaID = account.bankaID || account.BankaID;
    const iban = account.iban || account.IBAN;
    
    if (!bankaID || !iban) {
      throw new Error("Hesap bilgileri eksik. Lütfen hesabı düzenleyip tekrar deneyin.");
    }
    
    // Edit işlemiyle TAMAMEN AYNI format - account'tan direkt al
    const accountId = account.bankaHesapID || account.BankaHesapID;
    
    const data = {
      kullaniciID: user.kullaniciID,
      bankaID: bankaID,
      iban: iban,
      hesapAdi: account.hesapAdi || account.HesapAdi || null,
      aktifMi: false  // Sadece bu değişiyor
    };
    
    console.log("Pasife alma isteği - ID:", accountId, "Data:", JSON.stringify(data, null, 2));
    
    // Edit işlemiyle aynı endpoint formatı (parseInt yapmadan)
    const result = await API.put(`/BankaHesap/${accountId}`, data);
    
    console.log("Pasife alma sonucu:", result);
    
    if (result !== null && result !== undefined) {
      showBankAccountMessage("Hesap başarıyla pasife alındı.", "success");
      closeDeactivateModal();
      await loadBankAccounts();
    } else {
      // Backend boş response döndüyse de başarılı sayabiliriz
      showBankAccountMessage("Hesap başarıyla pasife alındı.", "success");
      closeDeactivateModal();
      await loadBankAccounts();
    }
  } catch (error) {
    console.error("Hesap pasife alma hatası:", error);
    const errorMsg = error.message || "İşlem başarısız";
    
    // Backend'den gelen hata mesajlarını kontrol et
    let displayMsg = "Hata: " + errorMsg;
    
    if (errorMsg.includes("Hesap bulunamadı") || errorMsg.includes("not found")) {
      displayMsg = "Hesap bulunamadı. Lütfen sayfayı yenileyin.";
    } else if (errorMsg.includes("Yetki") || errorMsg.includes("unauthorized") || errorMsg.includes("forbidden")) {
      displayMsg = "Bu işlem için yetkiniz bulunmamaktadır.";
    } else if (errorMsg.includes("IBAN") && (errorMsg.includes("zaten") || errorMsg.includes("kayıtlı"))) {
      displayMsg = "Bu IBAN zaten sistemde kayıtlı.";
    }
    
    document.getElementById("deactivateError").innerText = displayMsg;
    document.getElementById("deactivateError").style.display = "block";
  } finally {
    deactivateBtn.innerText = originalText;
    deactivateBtn.disabled = false;
  }
};

// Mesaj Gösterme (Banka Hesabı için)
function showBankAccountMessage(message, type = "success") {
  const container = document.getElementById("bankAccountMessage");
  const messageClass = type === "error" ? "error-message" : "success-message";
  const icon = type === "error" ? "fa-triangle-exclamation" : "fa-check-circle";
  
  container.innerHTML = `
    <div class="${messageClass}">
      <i class="fa-solid ${icon}"></i> ${message}
    </div>
  `;
  
  setTimeout(() => {
    container.innerHTML = "";
  }, 5000);
}

// --- FORM İŞLEMLERİ ---

// 1. Tahsilat Kaydet
document.getElementById("payForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("payId").value;
  const user = JSON.parse(localStorage.getItem("user"));

  const data = {
    odemeYontemID: document.getElementById("payMethod").value,
    tutar: document.getElementById("payAmount").value,
    aciklama: document.getElementById("payDesc").value,
    odemeTarihi: new Date().toISOString(),
  };

  try {
    const result = await API.put(`/KiraOdeme/pay/${id}`, data);
    if (result) {
      // Bildirim oluştur
      try {
        const payment = globalPayments.find(
          (p) => (p.kiraOdemeID || p.KiraOdemeID) == id
        );
        if (payment) {
          const propertyName = payment.mulk || payment.MulkBaslik || "Mülk";
          const tenantName = payment.kiraci || payment.KiraciAd || "Kiracı";
          const amount = payment.tutar || payment.Tutar;
          const currency = payment.paraBirimi || payment.ParaBirimi || "TRY";
          
          // Ev sahibine bildirim
          await Notifications.paymentReceived(user.kullaniciID, tenantName, amount, currency, propertyName);
          
          // Admin'e bildirim
          await Notifications.paymentReceivedForAdmin(user.adSoyad, tenantName, amount, currency, propertyName);
          
          // Kiracıya bildirim (KiraciID'den KullaniciID'ye çevir)
          const kiraciID = payment.kiraciID || payment.KiraciID;
          if (kiraciID) {
            try {
              const tumKiracilar = await API.get("/Kiraci/aktif");
              const kiraci = tumKiracilar?.find(
                (k) => (k.kiraciID || k.KiraciID) == kiraciID
              );
              const tenantKullaniciID = kiraci?.kullaniciID || kiraci?.KullaniciID;
              if (tenantKullaniciID) {
                await Notifications.paymentMade(tenantKullaniciID, propertyName, amount, currency);
              }
            } catch (kiraciError) {
              console.error("Kiracı bilgisi alınamadı:", kiraciError);
            }
          }
        }
      } catch (notifError) {
        console.error("Bildirim oluşturma hatası:", notifError);
      }
      
      alert("Tahsilat başarıyla kaydedildi!");
      closeModals();
      loadPayments(user.kullaniciID);
    }
  } catch (error) {
    alert(error.message);
  }
});

// 2. Yeni Ödeme Ekle / Düzenle (POST / PUT)
document
  .getElementById("addPaymentForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Hata mesajını temizle
    document.getElementById("paymentFormError").style.display = "none";
    
    const user = JSON.parse(localStorage.getItem("user"));
    const editId = document.getElementById("editPaymentId").value;

    const sozlesmeId = document.getElementById("contractSelect").value;
    if (!sozlesmeId) {
      document.getElementById("paymentFormError").innerText = "Lütfen bir sözleşme seçin.";
      document.getElementById("paymentFormError").style.display = "block";
      return;
    }

    const vadeTarihi = document.getElementById("newVade").value;
    const tutar = document.getElementById("newTutar").value;
    
    if (!vadeTarihi) {
      document.getElementById("paymentFormError").innerText = "Vade tarihi zorunludur.";
      document.getElementById("paymentFormError").style.display = "block";
      return;
    }
    
    if (!tutar || parseFloat(tutar) <= 0) {
      document.getElementById("paymentFormError").innerText = "Tutar 0'dan büyük olmalıdır.";
      document.getElementById("paymentFormError").style.display = "block";
      return;
    }

    const submitBtn = document.getElementById("paymentSubmitBtn");
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Kaydediliyor...";
    submitBtn.disabled = true;

    // Sözleşmeden ParaBirimiID'yi al
    let paraBirimiID = null;
    try {
      const contracts = await API.get(`/KiraSozlesme?userId=${user.kullaniciID}&role=Owner`);
      const contract = contracts?.find(c => (c.kiraSozlesmeID || c.KiraSozlesmeID) == sozlesmeId);
      if (contract) {
        paraBirimiID = contract.paraBirimiID || contract.ParaBirimiID;
        
        // Eğer sözleşmede ParaBirimiID yoksa, paraBirimiKod'dan ID'yi bul
        if (!paraBirimiID) {
          const paraBirimiKod = contract.paraBirimiKod || contract.ParaBirimiKod || "TRY";
          try {
            const sozluk = await API.get("/sozluk/all");
            if (sozluk) {
              const pbList = sozluk.ParaBirimi || sozluk.paraBirimi || [];
              const pb = pbList.find(p => (p.ParaBirimiKod || p.paraBirimiKod) === paraBirimiKod);
              if (pb) {
                paraBirimiID = pb.ParaBirimiID || pb.paraBirimiID;
              }
            }
          } catch (sozlukError) {
            console.error("Para birimi listesi alınamadı:", sozlukError);
          }
        }
      }
    } catch (contractError) {
      console.error("Sözleşme bilgisi alınamadı:", contractError);
    }

    // ParaBirimiID bulunamazsa varsayılan olarak TRY (1) kullan
    if (!paraBirimiID) {
      paraBirimiID = 1; // TRY varsayılan
    }

    const data = {
      kiraSozlesmeID: sozlesmeId,
      vadeTarihi: vadeTarihi,
      tutar: parseFloat(tutar),
      aciklama: document.getElementById("newAciklama").value || null,
      paraBirimiID: paraBirimiID, // ParaBirimiID eklendi
      odemeDurumID: 0, // Backend bunu 'Pending' veya tarih geçmişse 'Late' yapacak
    };

    try {
      let result;
      if (editId) {
        // GÜNCELLEME (PUT)
        result = await API.put(`/KiraOdeme/${editId}`, data);
        if (result !== null && result !== undefined) {
          alert("Ödeme planı başarıyla güncellendi.");
          closeModals();
          await loadPayments(user.kullaniciID);
        }
      } else {
        // YENİ EKLEME (POST)
        result = await API.post("/KiraOdeme", data);
        if (result !== null && result !== undefined) {
        // Bildirim oluştur
        try {
          // Sözleşme bilgilerini al
          const contracts = await API.get(`/KiraSozlesme?userId=${user.kullaniciID}&role=Owner`);
          const contract = contracts?.find(c => (c.kiraSozlesmeID || c.KiraSozlesmeID) == sozlesmeId);
          
          if (contract) {
            const propertyName = contract.mulkBaslik || contract.MulkBaslik || "Mülk";
            const tenantName = contract.kiraciAdSoyad || contract.KiraciAdSoyad || "Kiracı";
            const amount = data.tutar;
            const currency = contract.paraBirimiKod || contract.ParaBirimiKod || "TRY";
            const dueDate = data.vadeTarihi;
            
            // Ev sahibine bildirim
            await Notifications.paymentPlanCreated(user.kullaniciID, propertyName, tenantName, amount, currency, dueDate);
            
            // Kiracıya bildirim (KiraciID'den KullaniciID'ye çevir)
            const kiraciID = contract.kiraciID || contract.KiraciID;
            if (kiraciID) {
              try {
                const tumKiracilar = await API.get("/Kiraci/aktif");
                const kiraci = tumKiracilar?.find(
                  (k) => (k.kiraciID || k.KiraciID) == kiraciID
                );
                const tenantKullaniciID = kiraci?.kullaniciID || kiraci?.KullaniciID;
                if (tenantKullaniciID) {
                  await Notifications.paymentPlanCreatedForTenant(tenantKullaniciID, propertyName, amount, currency, dueDate);
                }
              } catch (kiraciError) {
                console.error("Kiracı bilgisi alınamadı:", kiraciError);
              }
            }
          }
        } catch (notifError) {
          console.error("Bildirim oluşturma hatası:", notifError);
        }
        
          alert("Yeni ödeme planı oluşturuldu.");
          closeModals();
          await loadPayments(user.kullaniciID);
        }
      }
    } catch (error) {
      console.error("Ödeme planı kaydetme hatası:", error);
      const errorMsg = error.message || "İşlem başarısız";
      document.getElementById("paymentFormError").innerText = "Hata: " + errorMsg;
      document.getElementById("paymentFormError").style.display = "block";
    } finally {
      submitBtn.innerText = originalText;
      submitBtn.disabled = false;
    }
  });

// --- YARDIMCILAR ---

// Sözleşmeleri Yükle (Dropdown İçin)
async function loadContracts(ownerId) {
  try {
    // Owner rolüyle sözleşmeleri çekiyoruz
    const contracts = await API.get(
      `/KiraSozlesme?userId=${ownerId}&role=Owner`
    );
    const select = document.getElementById("contractSelect");
    select.innerHTML = '<option value="">Seçiniz...</option>';

    if (contracts) {
      contracts.forEach((c) => {
        if (c.aktifMi) {
          const opt = document.createElement("option");
          opt.value = c.kiraSozlesmeID;
          // Kullanıcıya hangi ev ve kiracı olduğunu göster
          opt.text = `${c.mulkBaslik} - ${c.kiraciAdSoyad}`;
          select.appendChild(opt);
        }
      });
    }
  } catch (e) {
    console.error(e);
  }
}

async function loadMethods() {
  try {
    const sozluk = await API.get("/sozluk/all");
    if (sozluk) {
      const methods = sozluk.OdemeYontem || sozluk.odemeYontem || [];
      const select = document.getElementById("payMethod");
      select.innerHTML = "";
      methods.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.OdemeYontemID || m.odemeYontemID;
        opt.text = m.YontemAdi || m.yontemAdi;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error(e);
  }
}

// Ödeme Planı Düzenle
window.editPayment = function(id) {
  const payment = globalPayments.find(p => (p.kiraOdemeID || p.KiraOdemeID) == id);
  if (!payment) {
    alert("Ödeme planı bulunamadı.");
    return;
  }
  
  // Paid ödemeler düzenlenemez - Frontend'de hesaplanan durum
  const vadeTarihi = payment.vadeTarihi || payment.VadeTarihi;
  const odemeTarihi = payment.odemeTarihi || payment.OdemeTarihi;
  const calculatedStatus = calculatePaymentStatus(vadeTarihi, odemeTarihi);
  
  if (calculatedStatus.status === "Paid") {
    alert("Ödenmiş ödemeler düzenlenemez.");
    return;
  }
  
  document.getElementById("paymentFormTitle").innerText = "Ödeme Planı Düzenle";
  document.getElementById("editPaymentId").value = id;
  document.getElementById("contractSelect").value = payment.kiraSozlesmeID || payment.KiraSozlesmeID || "";
  
  // Tarih formatla (YYYY-MM-DD)
  const vade = payment.vadeTarihi || payment.VadeTarihi;
  if (vade) {
    const vadeDate = new Date(vade);
    const year = vadeDate.getFullYear();
    const month = String(vadeDate.getMonth() + 1).padStart(2, '0');
    const day = String(vadeDate.getDate()).padStart(2, '0');
    document.getElementById("newVade").value = `${year}-${month}-${day}`;
  }
  
  document.getElementById("newTutar").value = payment.tutar || payment.Tutar || "";
  document.getElementById("newAciklama").value = payment.aciklama || payment.Aciklama || "";
  
  // Hata mesajını temizle
  document.getElementById("paymentFormError").style.display = "none";
  
  document.getElementById("addModal").style.display = "flex";
};

// Ödeme Planı Sil
let paymentToDelete = null;

window.deletePayment = function(id) {
  const payment = globalPayments.find(p => (p.kiraOdemeID || p.KiraOdemeID) == id);
  if (!payment) {
    alert("Ödeme planı bulunamadı.");
    return;
  }
  
  // Paid ödemeler silinemez - Frontend'de hesaplanan durum
  const vadeTarihi = payment.vadeTarihi || payment.VadeTarihi;
  const odemeTarihi = payment.odemeTarihi || payment.OdemeTarihi;
  const calculatedStatus = calculatePaymentStatus(vadeTarihi, odemeTarihi);
  
  if (calculatedStatus.status === "Paid") {
    alert("Ödenmiş ödemeler silinemez.");
    return;
  }
  
  paymentToDelete = id;
  document.getElementById("deleteError").style.display = "none";
  document.getElementById("deletePaymentModal").style.display = "flex";
};

window.closeDeleteModal = function() {
  document.getElementById("deletePaymentModal").style.display = "none";
  paymentToDelete = null;
};

window.confirmDelete = async function() {
  if (!paymentToDelete) return;
  
  const deleteBtn = document.querySelector("#deletePaymentModal button:last-child");
  const originalText = deleteBtn.innerText;
  deleteBtn.innerText = "Siliniyor...";
  deleteBtn.disabled = true;
  
  try {
    const result = await API.delete(`/KiraOdeme/${paymentToDelete}`);
    
    if (result !== null && result !== undefined) {
      alert("Ödeme planı başarıyla silindi.");
      closeDeleteModal();
      const user = JSON.parse(localStorage.getItem("user"));
      await loadPayments(user.kullaniciID);
    }
  } catch (error) {
    console.error("Ödeme planı silme hatası:", error);
    const errorMsg = error.message || "İşlem başarısız";
    document.getElementById("deleteError").innerText = "Hata: " + errorMsg;
    document.getElementById("deleteError").style.display = "block";
  } finally {
    deleteBtn.innerText = originalText;
    deleteBtn.disabled = false;
  }
};

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("tr-TR");
}

// Ödeme durumunu tarih kontrolü ile hesapla
function calculatePaymentStatus(vadeTarihi, odemeTarihi) {
  // Ödeme tarihi varsa → Paid
  if (odemeTarihi && odemeTarihi.trim() !== "" && odemeTarihi !== "null") {
    return {
      status: "Paid",
      class: "bg-paid",
      text: "Ödendi"
    };
  }

  // Vade tarihi yoksa → Pending
  if (!vadeTarihi || vadeTarihi.trim() === "" || vadeTarihi === "null") {
    return {
      status: "Pending",
      class: "bg-pending",
      text: "Bekliyor"
    };
  }

  // Tarih karşılaştırması (sadece tarih, saat bilgisi yok)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const vadeDate = new Date(vadeTarihi);
  vadeDate.setHours(0, 0, 0, 0);

  // Vade tarihi geçmişse → Late
  if (vadeDate < today) {
    return {
      status: "Late",
      class: "bg-late",
      text: "Gecikti"
    };
  }

  // Vade tarihi henüz gelmemişse → Pending
  return {
    status: "Pending",
    class: "bg-pending",
    text: "Bekliyor"
  };
}

document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});
