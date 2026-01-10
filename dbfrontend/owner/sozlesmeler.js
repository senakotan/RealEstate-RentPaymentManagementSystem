// Global değişkenler
let globalContracts = [];
let currentFilter = 'all'; // 'all', 'active', 'inactive'

document.addEventListener("DOMContentLoaded", async () => {
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

  await loadContracts(user.kullaniciID);
});

// Filtre Değiştir
window.switchFilter = function(filter) {
  currentFilter = filter;
  
  // Tab stillerini güncelle
  const filterAll = document.getElementById("filterAll");
  const filterActive = document.getElementById("filterActive");
  const filterInactive = document.getElementById("filterInactive");
  
  if (filterAll) {
    filterAll.style.background = filter === 'all' ? 'linear-gradient(to right, #00c6ff, #0072ff)' : 'rgba(255,255,255,0.1)';
    filterAll.style.color = filter === 'all' ? '#fff' : '#ccc';
  }
  
  if (filterActive) {
    filterActive.style.background = filter === 'active' ? 'linear-gradient(to right, #00c853, #009624)' : 'rgba(255,255,255,0.1)';
    filterActive.style.color = filter === 'active' ? '#fff' : '#ccc';
  }
  
  if (filterInactive) {
    filterInactive.style.background = filter === 'inactive' ? 'rgba(255,75,92,0.2)' : 'rgba(255,255,255,0.1)';
    filterInactive.style.color = filter === 'inactive' ? '#ff4b5c' : '#ccc';
  }
  
  const user = JSON.parse(localStorage.getItem("user"));
  if (user && user.kullaniciID) {
    loadContracts(user.kullaniciID);
  }
};

// Sözleşmeleri Yükle
async function loadContracts(ownerId) {
  const tableBody = document.getElementById("contractList");
  
  if (!tableBody) {
    return;
  }

  try {
    // Backend: KiraSozlesmeController -> GetAll(userId, role)
    const contracts = await API.get(
      `/KiraSozlesme?userId=${ownerId}&role=Owner`
    );
    
    if (contracts === null) {
      throw new Error("API'den veri alınamadı. Backend bağlantısını kontrol edin.");
    }

    globalContracts = Array.isArray(contracts) ? contracts : [];
    
    // Filtrele - Basitleştirilmiş mantık
    let filteredContracts = [...globalContracts]; // Kopyala
    
    if (currentFilter === 'active') {
      filteredContracts = globalContracts.filter(c => {
        const aktifMi = c.aktifMi !== undefined ? c.aktifMi : (c.AktifMi !== undefined ? c.AktifMi : true);
        return aktifMi === true || aktifMi === 1 || aktifMi === "true";
      });
    } else if (currentFilter === 'inactive') {
      filteredContracts = globalContracts.filter(c => {
        const aktifMi = c.aktifMi !== undefined ? c.aktifMi : (c.AktifMi !== undefined ? c.AktifMi : false);
        return aktifMi === false || aktifMi === 0 || aktifMi === "false" || aktifMi === null;
      });
    }
    
    // Aktif sözleşmeler önce, sonra pasifler
    filteredContracts.sort((a, b) => {
      const aAktif = a.aktifMi !== undefined ? a.aktifMi : a.AktifMi;
      const bAktif = b.aktifMi !== undefined ? b.aktifMi : b.AktifMi;
      if (aAktif === bAktif) {
        // Aynı durumdaysa başlangıç tarihine göre sırala (yeni önce)
        const dateA = new Date(a.baslangicTarihi || a.BaslangicTarihi || 0);
        const dateB = new Date(b.baslangicTarihi || b.BaslangicTarihi || 0);
        return dateB - dateA;
      }
      return aAktif ? -1 : 1; // Aktifler önce
    });

    // Önce temizle
    tableBody.innerHTML = "";

    if (filteredContracts && filteredContracts.length > 0) {
      // innerHTML += yerine tüm HTML'i biriktirip tek seferde ekle
      let rowsHTML = "";
      
      filteredContracts.forEach((c, index) => {
        const id = c.kiraSozlesmeID || c.KiraSozlesmeID;
        const mulkBaslik = c.mulkBaslik || c.MulkBaslik || "Mülk";
        const mulkAdres = c.mulkAdres || c.MulkAdres || "";
        const kiraciAd = c.kiraciAdSoyad || c.KiraciAdSoyad || "Kiracı";
        const aylikKira = c.aylikKiraTutar || c.AylikKiraTutar || 0;
        const paraBirimi = c.paraBirimiKod || c.ParaBirimiKod || "TRY";
        const odemeGunu = c.odemeGunu || c.OdemeGunu || 1;
        const aktifMi = c.aktifMi !== undefined ? c.aktifMi : c.AktifMi;
        
        // Tarih formatlama
        const start = new Date(c.baslangicTarihi || c.BaslangicTarihi).toLocaleDateString("tr-TR");
        const end = c.bitisTarihi || c.BitisTarihi
          ? new Date(c.bitisTarihi || c.BitisTarihi).toLocaleDateString("tr-TR")
          : "Süresiz";

        const statusClass = aktifMi ? "active" : "passive";
        const statusText = aktifMi ? "Aktif" : "Pasif";
        
        // Satır stili (pasif sözleşmeler için)
        const rowStyle = aktifMi ? "" : "opacity:0.6;";

        rowsHTML += `
          <tr style="${rowStyle}">
            <td style="font-weight:600; color:#ddd;">${c.sozlesmeNo || "-"}</td>
            <td>
              <div style="font-weight:600;">${mulkBaslik}</div>
              <small style="color:#888; font-size:0.85rem;">${mulkAdres || "Adres bilgisi yok"}</small>
            </td>
            <td>${kiraciAd}</td>
            <td>
              <div class="contract-amount">${parseFloat(aylikKira).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
            </td>
            <td style="color:#8d97ad;">${paraBirimi}</td>
            <td style="text-align:center;">
              <span style="background:rgba(0,212,255,0.1); color:#00d4ff; padding:4px 10px; border-radius:15px; font-size:0.85rem; font-weight:600;">
                ${odemeGunu}. Gün
              </span>
            </td>
            <td>
              <div class="contract-dates">
                <div><i class="fa-solid fa-play" style="color:#00c853;"></i> ${start}</div>
                <div><i class="fa-solid fa-stop" style="color:#ff4b5c;"></i> ${end}</div>
              </div>
            </td>
            <td><span class="contract-status ${statusClass}">${statusText}</span></td>
            <td style="white-space:nowrap;">
              <button onclick="viewContractDetail(${id})" class="btn-action btn-edit" title="Detay Görüntüle" style="margin-right:5px;">
                <i class="fa-solid fa-eye"></i>
              </button>
              <button onclick="editContract(${id})" class="btn-action btn-edit" title="Düzenle" style="margin-right:5px; background:rgba(0,212,255,0.1); color:#00d4ff;">
                <i class="fa-solid fa-pen"></i>
              </button>
              ${aktifMi
                ? `<button onclick="terminateContract(${id})" class="btn-action btn-delete" title="Sözleşmeyi Pasife Al"><i class="fa-solid fa-ban"></i></button>`
                : '<span style="color:#888;">-</span>'
              }
            </td>
          </tr>
        `;
      });
      
      // Tüm satırları tek seferde ekle
      tableBody.innerHTML = rowsHTML;
    } else {
      tableBody.innerHTML =
        "<tr><td colspan='9' style='text-align:center; padding:2rem; color:#888;'>Henüz sözleşme bulunmuyor.</td></tr>";
    }
  } catch (error) {
    const errorMessage = error.message || "Bilinmeyen hata";
    tableBody.innerHTML =
      `<tr><td colspan='9' style='color:red; text-align:center; padding:2rem;'>
        <div style='margin-bottom:10px;'><i class='fa-solid fa-exclamation-triangle'></i> Veri yüklenemedi</div>
        <small style='color:#888;'>${errorMessage}</small>
      </td></tr>`;
  }
}

// Sözleşme Detayını Görüntüle
window.viewContractDetail = function(id) {
  window.location.href = `sozlesme-detay.html?id=${id}`;
};

window.editContract = function(id) {
  window.location.href = `sozlesme-edit.html?id=${id}`;
};

// Sözleşme Fesih (Pasife Alma - Soft Delete)
window.terminateContract = async function (id) {
  const contract = globalContracts.find(c => (c.kiraSozlesmeID || c.KiraSozlesmeID) == id);
  if (!contract) {
    alert("Sözleşme bulunamadı.");
    return;
  }
  
  const mulkBaslik = contract.mulkBaslik || contract.MulkBaslik || "Mülk";
  const kiraciAd = contract.kiraciAdSoyad || contract.KiraciAdSoyad || "Kiracı";
  
  if (
    !confirm(
      `"${mulkBaslik}" mülkü için "${kiraciAd}" ile olan sözleşmeyi pasife almak istediğinize emin misiniz?\n\nBu işlem sözleşmeyi pasif yapar ancak veriler korunur.`
    )
  ) {
    return;
  }
  
  try {
    // DELETE endpoint kullan (soft delete)
    const res = await API.delete(`/KiraSozlesme/${id}`);

    if (res !== null && res !== undefined) {
      // Bildirim oluştur
      try {
        const user = JSON.parse(localStorage.getItem("user"));
        // Sözleşme bilgilerini al (response'dan veya sayfadan)
        const contracts = await API.get(`/KiraSozlesme?userId=${user.kullaniciID}&role=Owner`);
        const contract = contracts?.find(c => (c.kiraSozlesmeID || c.KiraSozlesmeID) == id);
        
        if (contract) {
          const propertyName = contract.mulkBaslik || contract.MulkBaslik || "Mülk";
          const tenantName = contract.kiraciAdSoyad || contract.KiraciAdSoyad || "Kiracı";
          const kiraciID = contract.kiraciID || contract.KiraciID;
          
          // Ev sahibine bildirim
          await Notifications.contractTerminated(user.kullaniciID, tenantName, propertyName);
          
          // Kiracıya bildirim (KiraciID'den KullaniciID'ye çevir)
          if (kiraciID) {
            try {
              const tumKiracilar = await API.get("/Kiraci/aktif");
              const kiraci = tumKiracilar?.find(
                (k) => (k.kiraciID || k.KiraciID) == kiraciID
              );
              const tenantKullaniciID = kiraci?.kullaniciID || kiraci?.KullaniciID;
              if (tenantKullaniciID) {
                await Notifications.contractTerminatedForTenant(tenantKullaniciID, propertyName);
              }
            } catch (kiraciError) {
              // Sessiz hata yönetimi
            }
          }
        }
      } catch (notifError) {
        // Sessiz hata yönetimi
      }
      
      alert("Sözleşme başarıyla pasife alındı.");
      const user = JSON.parse(localStorage.getItem("user"));
      await loadContracts(user.kullaniciID);
    } else {
      alert("İşlem başarısız.");
    }
  } catch (err) {
    const errorMsg = err.message || "İşlem başarısız";
    
    // Backend'den gelen hata mesajlarını kontrol et
    if (errorMsg.includes("çakışma") || errorMsg.includes("overlap") || errorMsg.includes("conflict")) {
      alert("Bu sözleşme başka bir sözleşme ile çakışıyor. Lütfen kontrol edin.");
    } else {
      alert("Hata oluştu: " + errorMsg);
    }
  }
};

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});
