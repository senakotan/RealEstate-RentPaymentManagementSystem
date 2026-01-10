document.addEventListener("DOMContentLoaded", async () => {
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);

  if (user.rol !== "Tenant") {
    window.location.href = "../index.html";
    return;
  }

  // URL'den ID'yi al
  const urlParams = new URLSearchParams(window.location.search);
  const contractId = urlParams.get("id");

  if (!contractId) {
    alert("Sözleşme ID'si bulunamadı.");
    window.location.href = "sozlesmeler.html";
    return;
  }

  await loadContractDetail(contractId);
});

async function loadContractDetail(id) {
  const loadingEl = document.getElementById("loadingMessage");
  const detailEl = document.getElementById("contractDetail");

  try {
    // GET /api/KiraSozlesme/{id}
    let contract = await API.get(`/KiraSozlesme/${id}`);

    // Eğer sözleşme bulunamazsa, tenant'ın tüm sözleşmelerini çekip filtrele
    if (!contract) {
      try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          const tenantId = user.kullaniciID || user.KullaniciID;
          
          if (tenantId) {
            // Tenant'ın sözleşmelerini çek (userId ve role ile)
            const contracts = await API.get(`/KiraSozlesme?userId=${tenantId}&role=Tenant`);
            
            if (Array.isArray(contracts) && contracts.length > 0) {
              // ID'ye göre sözleşmeyi bul
              contract = contracts.find(c => {
                const cId = c.kiraSozlesmeID || c.KiraSozlesmeID;
                return cId == id || cId === parseInt(id);
              });
            }
          }
        }
      } catch (fallbackError) {
        // Sessiz hata yönetimi
      }
    }

    if (!contract) {
      alert("Sözleşme bulunamadı.");
      window.location.href = "sozlesmeler.html";
      return;
    }

    // Sözleşme Bilgileri
    document.getElementById("sozlesmeNo").innerText = contract.sozlesmeNo || contract.SozlesmeNo || "-";
    
    const aktifMi = contract.aktifMi !== undefined ? contract.aktifMi : contract.AktifMi;
    const statusClass = aktifMi ? "active" : "passive";
    const statusText = aktifMi ? "Aktif" : "Pasif";
    document.getElementById("durum").innerHTML = `<span class="status-badge ${statusClass}">${statusText}</span>`;

    const baslangic = new Date(contract.baslangicTarihi || contract.BaslangicTarihi);
    document.getElementById("baslangicTarihi").innerText = baslangic.toLocaleDateString("tr-TR", {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    if (contract.bitisTarihi || contract.BitisTarihi) {
      const bitis = new Date(contract.bitisTarihi || contract.BitisTarihi);
      document.getElementById("bitisTarihi").innerText = bitis.toLocaleDateString("tr-TR", {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } else {
      document.getElementById("bitisTarihi").innerText = "Süresiz";
    }

    document.getElementById("aciklama").innerText = contract.aciklama || contract.Aciklama || "Açıklama yok";

    // Mülk Bilgileri
    document.getElementById("mulkBaslik").innerText = contract.mulkBaslik || contract.MulkBaslik || "-";
    document.getElementById("mulkAdres").innerText = contract.mulkAdres || contract.MulkAdres || "Adres bilgisi yok";

    // Ev Sahibi Bilgileri
    document.getElementById("sahipAd").innerText = contract.mulkSahibiAd || contract.MulkSahibiAd || "-";

    // Ödeme Bilgileri
    const aylikKira = contract.aylikKiraTutar || contract.AylikKiraTutar || 0;
    const paraBirimi = contract.paraBirimiKod || contract.ParaBirimiKod || "TRY";
    document.getElementById("aylikKira").innerText = `${parseFloat(aylikKira).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${paraBirimi}`;
    document.getElementById("paraBirimi").innerText = paraBirimi;
    
    const odemeGunu = contract.odemeGunu || contract.OdemeGunu || 1;
    document.getElementById("odemeGunu").innerText = `Her ayın ${odemeGunu}. günü`;

    const depozito = contract.depozitoTutar || contract.DepozitoTutar || 0;
    document.getElementById("depozito").innerText = depozito > 0 
      ? `${parseFloat(depozito).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${paraBirimi}`
      : "Depozito yok";

    // Ödemeler linkini ayarla
    const sozlesmeId = contract.kiraSozlesmeID || contract.KiraSozlesmeID;
    document.getElementById("viewPaymentsLink").href = `odemeler.html?sozlesmeId=${sozlesmeId}`;

    loadingEl.style.display = "none";
    detailEl.style.display = "block";

  } catch (error) {
    alert("Sözleşme bilgileri yüklenemedi: " + (error.message || "Bilinmeyen hata"));
    window.location.href = "sozlesmeler.html";
  }
}

window.goBack = function() {
  window.location.href = "sozlesmeler.html";
};

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});

