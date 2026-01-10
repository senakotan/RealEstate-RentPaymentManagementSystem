// Global değişkenler
let globalReminders = [];
let reminderToDeactivate = null;
let currentFilter = 'all'; // 'all', 'active', 'inactive'
let globalProperties = [];
let globalContracts = [];

// Sayfa yüklendiğinde
document.addEventListener("DOMContentLoaded", async () => {
  // Yetki kontrolü
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

  // Çıkış butonu
  document.getElementById("btnLogout")?.addEventListener("click", () => {
    localStorage.removeItem("user");
    window.location.href = "../index.html";
  });

  // Form submit
  document.getElementById("reminderForm")?.addEventListener("submit", handleReminderSubmit);

  // İlk yükleme
  await loadProperties(user.kullaniciID);
  await loadContracts(user.kullaniciID);
  await loadReminders();
});

// Mülkleri Yükle (Sadece aktif sözleşmelerdeki mülkler)
async function loadProperties(userId) {
  try {
    // Önce aktif sözleşmeleri al
    const contracts = await API.get(`/KiraSozlesme?userId=${userId}&role=Owner`);
    
    // Aktif sözleşmelerdeki mülk ID'lerini topla
    const aktifSozlesmeMulkIDs = new Set();
    if (contracts && contracts.length > 0) {
      contracts.forEach(contract => {
        const aktifMi = contract.aktifMi !== undefined ? contract.aktifMi : contract.AktifMi;
        if (aktifMi) {
          const mulkID = contract.mulkID || contract.MulkID;
          if (mulkID) {
            aktifSozlesmeMulkIDs.add(mulkID);
          }
        }
      });
    }
    
    // Tüm mülkleri al (globalProperties için)
    const allProperties = await API.get(`/Mulk?sahipId=${userId}`);
    globalProperties = allProperties || [];
    
    const mulkSelect = document.getElementById("mulkSelect");
    if (mulkSelect) {
      mulkSelect.innerHTML = '<option value="">Seçiniz...</option>';
      
      if (globalProperties && globalProperties.length > 0) {
        // Sadece aktif sözleşmelerdeki mülkleri göster
        globalProperties.forEach(prop => {
          const propID = prop.mulkID || prop.MulkID;
          const aktifMi = prop.aktifMi !== undefined ? prop.aktifMi : prop.AktifMi;
          
          // Hem aktif mülk hem de aktif sözleşmede olmalı
          if (aktifMi && aktifSozlesmeMulkIDs.has(propID)) {
            const opt = document.createElement("option");
            opt.value = propID;
            opt.text = prop.baslik || prop.Baslik || "Mülk";
            mulkSelect.appendChild(opt);
          }
        });
      }
      
      // Eğer hiç mülk yoksa bilgi ver
      if (mulkSelect.options.length === 1) {
        mulkSelect.innerHTML = '<option value="">Aktif sözleşmeli mülk bulunamadı</option>';
      }
    }
  } catch (e) {
    const mulkSelect = document.getElementById("mulkSelect");
    if (mulkSelect) {
      mulkSelect.innerHTML = '<option value="">Mülk listesi yüklenemedi</option>';
    }
  }
}

// Sözleşmeleri Yükle
async function loadContracts(userId) {
  try {
    const contracts = await API.get(`/KiraSozlesme?userId=${userId}&role=Owner`);
    globalContracts = contracts || [];
    
    const sozlesmeSelect = document.getElementById("sozlesmeSelect");
    if (sozlesmeSelect) {
      sozlesmeSelect.innerHTML = '<option value="">Seçiniz...</option>';
      
      if (globalContracts && globalContracts.length > 0) {
        globalContracts.forEach(contract => {
          // Sadece aktif sözleşmeleri göster
          const aktifMi = contract.aktifMi !== undefined ? contract.aktifMi : contract.AktifMi;
          if (aktifMi) {
            const opt = document.createElement("option");
            opt.value = contract.kiraSozlesmeID || contract.KiraSozlesmeID;
            const mulkBaslik = contract.mulkBaslik || contract.MulkBaslik || "Mülk";
            const kiraciAd = contract.kiraciAd || contract.KiraciAd || "Kiracı";
            opt.text = `${mulkBaslik} - ${kiraciAd}`;
            sozlesmeSelect.appendChild(opt);
          }
        });
      }
    }
  } catch (e) {
    const sozlesmeSelect = document.getElementById("sozlesmeSelect");
    if (sozlesmeSelect) {
      sozlesmeSelect.innerHTML = '<option value="">Sözleşme listesi yüklenemedi</option>';
    }
  }
}

// Hatırlatıcıları Yükle
async function loadReminders() {
  const loadingEl = document.getElementById("reminderLoading");
  const listEl = document.getElementById("reminderList");
  const tableBody = document.getElementById("reminderTableBody");
  const emptyEl = document.getElementById("reminderEmpty");
  const user = JSON.parse(localStorage.getItem("user"));
  
  loadingEl.style.display = "block";
  listEl.style.display = "none";
  emptyEl.style.display = "none";
  
  try {
    // Filtreye göre endpoint
    let endpoint = `/Hatirlatici/kullanici/${user.kullaniciID}`;
    if (currentFilter === 'active') {
      endpoint += '?aktifMi=true';
    } else if (currentFilter === 'inactive') {
      endpoint += '?aktifMi=false';
    }
    
    const reminders = await API.get(endpoint);
    
    loadingEl.style.display = "none";
    
    if (reminders && reminders.length > 0) {
      // Tarihe göre sırala (yaklaşanlar önce)
      globalReminders = reminders.sort((a, b) => {
        const dateA = new Date(a.hatirlaticiTarihi || a.HatirlaticiTarihi || 0);
        const dateB = new Date(b.hatirlaticiTarihi || b.HatirlaticiTarihi || 0);
        return dateA - dateB;
      });
      
      tableBody.innerHTML = "";
      
      globalReminders.forEach(reminder => {
        const id = reminder.hatirlaticiID || reminder.HatirlaticiID;
        const baslik = reminder.baslik || reminder.Baslik || "Hatırlatıcı";
        const aciklama = reminder.aciklama || reminder.Aciklama || "";
        const tarih = reminder.hatirlaticiTarihi || reminder.HatirlaticiTarihi;
        const aktifMi = reminder.aktifMi !== undefined ? reminder.aktifMi : reminder.AktifMi;
        const mulkID = reminder.ilgiliMulkID || reminder.IlgiliMulkID;
        const sozlesmeID = reminder.ilgiliKiraSozlesmeID || reminder.IlgiliKiraSozlesmeID;
        
        // Tarih formatla
        const tarihObj = tarih ? new Date(tarih) : null;
        const tarihStr = tarihObj ? formatDate(tarihObj) : "-";
        
        // Kalan gün hesapla
        const daysInfo = calculateDaysRemaining(tarihObj);
        
        // Mülk bilgisi - API'den gelen MulkBaslik'i kullan
        let mulkText = "-";
        const mulkBaslik = reminder.mulkBaslik || reminder.MulkBaslik;
        if (mulkBaslik) {
          mulkText = mulkBaslik;
        }
        
        // Sözleşme bilgisi - API'den gelen SozlesmeNo ve KiraciAd'ı kullan
        let sozlesmeText = "-";
        const sozlesmeNo = reminder.sozlesmeNo || reminder.SozlesmeNo;
        const kiraciAd = reminder.kiraciAd || reminder.KiraciAd;
        if (sozlesmeNo) {
          if (kiraciAd) {
            sozlesmeText = `${sozlesmeNo} - ${kiraciAd}`;
          } else {
            sozlesmeText = sozlesmeNo;
          }
        }
        
        // Durum ve stil
        const statusClass = aktifMi ? "status-active" : "status-inactive";
        const statusText = aktifMi ? "Aktif" : "Pasif";
        
        // Kalan gün stili
        let daysClass = "days-normal";
        if (daysInfo.urgent) {
          daysClass = "days-urgent";
        } else if (daysInfo.warning) {
          daysClass = "days-warning";
        } else if (daysInfo.past) {
          daysClass = "days-past";
        }
        
        // Satır stili (yaklaşanlar için vurgu)
        let rowStyle = "";
        if (aktifMi && daysInfo.urgent) {
          rowStyle = "background:rgba(255,75,92,0.1);";
        } else if (aktifMi && daysInfo.warning) {
          rowStyle = "background:rgba(255,179,0,0.1);";
        }
        
        const row = `
          <tr style="${rowStyle}">
            <td style="font-weight:600; ${!aktifMi ? 'opacity:0.6;' : ''}">${baslik}</td>
            <td style="${!aktifMi ? 'opacity:0.6;' : ''}">${tarihStr}</td>
            <td>
              <span class="days-remaining ${daysClass}">${daysInfo.text}</span>
            </td>
            <td style="color:#8d97ad; ${!aktifMi ? 'opacity:0.6;' : ''}">${mulkText}</td>
            <td style="color:#8d97ad; ${!aktifMi ? 'opacity:0.6;' : ''}">${sozlesmeText}</td>
            <td>
              <span class="reminder-status ${statusClass}">${statusText}</span>
            </td>
            <td style="white-space:nowrap;">
              <button class="action-btn btn-edit" onclick="editReminder(${id})" title="Düzenle" style="margin-right:5px; ${!aktifMi ? 'opacity:0.5;' : ''}">
                <i class="fa-solid fa-pen"></i> Düzenle
              </button>
              <button class="action-btn btn-delete" onclick="deactivateReminder(${id})" title="Pasife Al" ${!aktifMi ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>
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
    loadingEl.style.display = "none";
    showReminderMessage("Hatırlatıcı listesi yüklenirken hata oluştu.", "error");
  }
}

// Tarih formatla (dd.MM.yyyy)
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

// Kalan gün hesapla
function calculateDaysRemaining(date) {
  if (!date) {
    return { text: "-", urgent: false, warning: false, past: false };
  }
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderDate = new Date(date);
    
    // Tarih geçerliliğini kontrol et
    if (isNaN(reminderDate.getTime())) {
      return { text: "Geçersiz tarih", urgent: false, warning: false, past: false };
    }
    
    reminderDate.setHours(0, 0, 0, 0);
    
    const diffTime = reminderDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // NaN kontrolü
    if (isNaN(diffDays)) {
      return { text: "Tarih hesaplanamadı", urgent: false, warning: false, past: false };
    }
    
    if (diffDays < 0) {
      return { 
        text: `Süresi geçti (${Math.abs(diffDays)} gün)`, 
        urgent: false, 
        warning: false, 
        past: true 
      };
    } else if (diffDays === 0) {
      return { text: "Bugün", urgent: true, warning: false, past: false };
    } else if (diffDays <= 3) {
      return { text: `${diffDays} gün kaldı`, urgent: true, warning: false, past: false };
    } else if (diffDays <= 7) {
      return { text: `${diffDays} gün kaldı`, urgent: false, warning: true, past: false };
    } else {
      return { text: `${diffDays} gün kaldı`, urgent: false, warning: false, past: false };
    }
  } catch (error) {
    return { text: "Tarih hatası", urgent: false, warning: false, past: false };
  }
}

// Filtre Değiştir
window.switchFilter = function(filter) {
  currentFilter = filter;
  
  // Tab stillerini güncelle
  document.getElementById("filterAll").classList.remove("active");
  document.getElementById("filterActive").classList.remove("active");
  document.getElementById("filterInactive").classList.remove("active");
  
  if (filter === 'all') {
    document.getElementById("filterAll").classList.add("active");
  } else if (filter === 'active') {
    document.getElementById("filterActive").classList.add("active");
  } else if (filter === 'inactive') {
    document.getElementById("filterInactive").classList.add("active");
  }
  
  loadReminders();
};

// Mülk Değiştiğinde
window.handleMulkChange = function() {
  const mulkSelect = document.getElementById("mulkSelect");
  const sozlesmeSelect = document.getElementById("sozlesmeSelect");
  
  if (mulkSelect.value) {
    // Mülk seçildiyse sözleşmeyi temizle
    sozlesmeSelect.value = "";
  }
};

// Sözleşme Değiştiğinde
window.handleSozlesmeChange = function() {
  const mulkSelect = document.getElementById("mulkSelect");
  const sozlesmeSelect = document.getElementById("sozlesmeSelect");
  
  if (sozlesmeSelect.value) {
    // Sözleşme seçildiyse mülkü temizle
    mulkSelect.value = "";
  }
};

// Yeni Hatırlatıcı Modalını Aç
window.openAddReminderModal = function() {
  document.getElementById("reminderFormTitle").innerText = "Yeni Hatırlatıcı Ekle";
  document.getElementById("reminderForm").reset();
  document.getElementById("editReminderId").value = "";
  document.getElementById("aktifMiCheck").checked = true;
  
  // Dropdown'ları temizle
  document.getElementById("mulkSelect").value = "";
  document.getElementById("sozlesmeSelect").value = "";
  
  // Hata mesajlarını temizle
  document.getElementById("reminderFormError").style.display = "none";
  document.getElementById("baslikError").style.display = "none";
  document.getElementById("tarihError").style.display = "none";
  
  document.getElementById("reminderModal").style.display = "flex";
};

// Hatırlatıcı Düzenle
window.editReminder = function(id) {
  const reminder = globalReminders.find(r => (r.hatirlaticiID || r.HatirlaticiID) == id);
  if (!reminder) {
    showReminderMessage("Hatırlatıcı bulunamadı.", "error");
    return;
  }
  
  document.getElementById("reminderFormTitle").innerText = "Hatırlatıcı Düzenle";
  document.getElementById("editReminderId").value = id;
  document.getElementById("baslikInput").value = reminder.baslik || reminder.Baslik || "";
  document.getElementById("aciklamaInput").value = reminder.aciklama || reminder.Aciklama || "";
  
  // Tarih formatla (YYYY-MM-DD)
  const tarih = reminder.hatirlaticiTarihi || reminder.HatirlaticiTarihi;
  if (tarih) {
    const tarihObj = new Date(tarih);
    const year = tarihObj.getFullYear();
    const month = String(tarihObj.getMonth() + 1).padStart(2, '0');
    const day = String(tarihObj.getDate()).padStart(2, '0');
    document.getElementById("tarihInput").value = `${year}-${month}-${day}`;
  }
  
  // Mülk veya Sözleşme - sadece biri seçili olmalı
  const reminderMulkID = reminder.ilgiliMulkID || reminder.IlgiliMulkID || "";
  const reminderSozlesmeID = reminder.ilgiliKiraSozlesmeID || reminder.IlgiliKiraSozlesmeID || "";
  
  // Eğer ikisi de varsa, sözleşmeyi önceliklendir (daha spesifik)
  if (reminderMulkID && reminderSozlesmeID) {
    // İkisi birden varsa, sadece sözleşmeyi göster
    document.getElementById("mulkSelect").value = "";
    document.getElementById("sozlesmeSelect").value = reminderSozlesmeID;
  } else {
    document.getElementById("mulkSelect").value = reminderMulkID;
    document.getElementById("sozlesmeSelect").value = reminderSozlesmeID;
  }
  
  document.getElementById("aktifMiCheck").checked = reminder.aktifMi !== undefined ? reminder.aktifMi : reminder.AktifMi;
  
  // Hata mesajlarını temizle
  document.getElementById("reminderFormError").style.display = "none";
  document.getElementById("baslikError").style.display = "none";
  document.getElementById("tarihError").style.display = "none";
  
  document.getElementById("reminderModal").style.display = "flex";
};

// Hatırlatıcı Pasife Al
window.deactivateReminder = function(id) {
  const reminder = globalReminders.find(r => {
    const rId = r.hatirlaticiID || r.HatirlaticiID;
    return rId == id || rId === parseInt(id);
  });
  
  if (!reminder) {
    showReminderMessage("Hatırlatıcı bulunamadı.", "error");
    return;
  }
  
  // Zaten pasifse uyarı ver
  const aktifMi = reminder.aktifMi !== undefined ? reminder.aktifMi : reminder.AktifMi;
  if (!aktifMi) {
    showReminderMessage("Bu hatırlatıcı zaten pasif durumda.", "error");
    return;
  }
  
  reminderToDeactivate = { 
    id: reminder.hatirlaticiID || reminder.HatirlaticiID, 
    baslik: reminder.baslik || reminder.Baslik || "" 
  };
  document.getElementById("deactivateError").style.display = "none";
  document.getElementById("deactivateReminderModal").style.display = "flex";
};

window.closeDeactivateModal = function() {
  document.getElementById("deactivateReminderModal").style.display = "none";
  reminderToDeactivate = null;
};

window.confirmDeactivate = async function() {
  if (!reminderToDeactivate) return;
  
  const deactivateBtn = document.querySelector("#deactivateReminderModal button:last-child");
  const originalText = deactivateBtn.innerText;
  deactivateBtn.innerText = "İşleniyor...";
  deactivateBtn.disabled = true;
  
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    const reminder = globalReminders.find(r => (r.hatirlaticiID || r.HatirlaticiID) == reminderToDeactivate.id);
    
    if (reminder) {
      const data = {
        kullaniciID: user.kullaniciID,
        baslik: reminder.baslik || reminder.Baslik,
        aciklama: reminder.aciklama || reminder.Aciklama || null,
        hatirlaticiTarihi: reminder.hatirlaticiTarihi || reminder.HatirlaticiTarihi,
        ilgiliMulkID: reminder.ilgiliMulkID || reminder.IlgiliMulkID || null,
        ilgiliKiraSozlesmeID: reminder.ilgiliKiraSozlesmeID || reminder.IlgiliKiraSozlesmeID || null,
        aktifMi: false
      };
      
      const result = await API.put(`/Hatirlatici/${reminderToDeactivate.id}`, data);
      
      if (result !== null && result !== undefined) {
        showReminderMessage("Hatırlatıcı başarıyla pasife alındı.", "success");
        closeDeactivateModal();
        await loadReminders();
      } else {
        showReminderMessage("Hatırlatıcı başarıyla pasife alındı.", "success");
        closeDeactivateModal();
        await loadReminders();
      }
    }
  } catch (error) {
    const errorMsg = error.message || "İşlem başarısız";
    document.getElementById("deactivateError").innerText = "Hata: " + errorMsg;
    document.getElementById("deactivateError").style.display = "block";
  } finally {
    deactivateBtn.innerText = originalText;
    deactivateBtn.disabled = false;
  }
};

// Form Submit
async function handleReminderSubmit(e) {
  e.preventDefault();
  
  // Hata mesajlarını temizle
  document.getElementById("reminderFormError").style.display = "none";
  document.getElementById("baslikError").style.display = "none";
  document.getElementById("tarihError").style.display = "none";
  
  const user = JSON.parse(localStorage.getItem("user"));
  const editId = document.getElementById("editReminderId").value;
  const baslik = document.getElementById("baslikInput").value.trim();
  const aciklama = document.getElementById("aciklamaInput").value.trim();
  const tarih = document.getElementById("tarihInput").value;
  const mulkID = document.getElementById("mulkSelect").value;
  const sozlesmeID = document.getElementById("sozlesmeSelect").value;
  const aktifMi = document.getElementById("aktifMiCheck").checked;
  
  // Validation
  if (!baslik) {
    document.getElementById("baslikError").innerText = "Başlık zorunludur.";
    document.getElementById("baslikError").style.display = "block";
    return;
  }
  
  if (!tarih) {
    document.getElementById("tarihError").innerText = "Hatırlatma tarihi zorunludur.";
    document.getElementById("tarihError").style.display = "block";
    return;
  }
  
  const submitBtn = document.getElementById("reminderSubmitBtn");
  const originalText = submitBtn.innerText;
  submitBtn.innerText = "Kaydediliyor...";
  submitBtn.disabled = true;
  
  // Mülk veya Sözleşme seçilmişse, diğerini null yap
  const finalMulkID = mulkID || null;
  const finalSozlesmeID = sozlesmeID || null;
  
  const data = {
    kullaniciID: user.kullaniciID,
    baslik: baslik,
    aciklama: aciklama || null,
    hatirlaticiTarihi: tarih + "T00:00:00", // ISO format
    ilgiliMulkID: finalMulkID,
    ilgiliKiraSozlesmeID: finalSozlesmeID,
    aktifMi: aktifMi
  };
  
  try {
    let result;
    if (editId) {
      // Güncelleme
      result = await API.put(`/Hatirlatici/${editId}`, data);
      if (result !== null && result !== undefined) {
        showReminderMessage("Hatırlatıcı başarıyla güncellendi.", "success");
        closeModals();
        await loadReminders();
      }
    } else {
      // Yeni Ekleme
      result = await API.post("/Hatirlatici", data);
      if (result !== null && result !== undefined) {
        showReminderMessage("Hatırlatıcı başarıyla eklendi.", "success");
        closeModals();
        await loadReminders();
      }
    }
  } catch (error) {
    const errorMsg = error.message || "İşlem başarısız";
    
    // Backend'den gelen hata mesajlarını kontrol et
    if (errorMsg.includes("Başlık") && errorMsg.includes("zorunlu")) {
      document.getElementById("baslikError").innerText = "Başlık zorunludur.";
      document.getElementById("baslikError").style.display = "block";
    } else if (errorMsg.includes("Tarih") && errorMsg.includes("zorunlu")) {
      document.getElementById("tarihError").innerText = "Hatırlatma tarihi zorunludur.";
      document.getElementById("tarihError").style.display = "block";
    } else if (errorMsg.includes("bulunamadı") || errorMsg.includes("not found")) {
      document.getElementById("reminderFormError").innerText = "Hatırlatıcı bulunamadı.";
      document.getElementById("reminderFormError").style.display = "block";
    } else {
      document.getElementById("reminderFormError").innerText = "Hata: " + errorMsg;
      document.getElementById("reminderFormError").style.display = "block";
    }
  } finally {
    submitBtn.innerText = originalText;
    submitBtn.disabled = false;
  }
}

// Tüm Modalları Kapat
window.closeModals = function() {
  document.getElementById("reminderModal").style.display = "none";
  document.getElementById("deactivateReminderModal").style.display = "none";
  
  // Formları temizle
  document.getElementById("reminderForm")?.reset();
  document.getElementById("editReminderId").value = "";
  reminderToDeactivate = null;
};

// Mesaj Gösterme
function showReminderMessage(message, type = "success") {
  const container = document.getElementById("reminderMessage");
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

