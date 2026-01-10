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

  await loadContracts(user.kullaniciID);
});

// Sözleşmeleri Yükle
async function loadContracts(userId) {
  const tableBody = document.getElementById("contractList");

  try {
    // Backend: KiraSozlesmeController -> GetAll(userId, role=Tenant)
    const contracts = await API.get(
      `/KiraSozlesme?userId=${userId}&role=Tenant`
    );

    tableBody.innerHTML = "";

    if (contracts && contracts.length > 0) {
      // Aktif sözleşmeler önce, sonra pasifler
      contracts.sort((a, b) => {
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

      contracts.forEach((c) => {
        const id = c.kiraSozlesmeID || c.KiraSozlesmeID;
        const mulkBaslik = c.mulkBaslik || c.MulkBaslik || "Mülk";
        const mulkAdres = c.mulkAdres || c.MulkAdres || "";
        const sahipAd = c.mulkSahibiAd || c.MulkSahibiAd || "Ev Sahibi";
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

        const row = `
          <tr style="${rowStyle}">
            <td style="font-weight:600; color:#ddd;">${c.sozlesmeNo || "-"}</td>
            <td>
              <div style="font-weight:600;">${mulkBaslik}</div>
              <small style="color:#888; font-size:0.85rem;">${mulkAdres || "Adres bilgisi yok"}</small>
            </td>
            <td>${sahipAd}</td>
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
              <button onclick="viewContractDetail(${id})" class="btn-action btn-edit" title="Detay Görüntüle">
                <i class="fa-solid fa-eye"></i>
              </button>
            </td>
          </tr>
        `;
        tableBody.innerHTML += row;
      });
    } else {
      tableBody.innerHTML =
        "<tr><td colspan='9' style='text-align:center; padding:2rem; color:#888;'>Henüz sözleşme bulunmuyor.</td></tr>";
    }
  } catch (error) {
    console.error("Sözleşme hatası:", error);
    tableBody.innerHTML =
      "<tr><td colspan='9' style='color:red; text-align:center; padding:2rem;'>Veri yüklenemedi.</td></tr>";
  }
}

// Sözleşme Detayını Görüntüle
window.viewContractDetail = function(id) {
  window.location.href = `sozlesme-detay.html?id=${id}`;
};

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});

