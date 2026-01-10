let globalMulkler = [];

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Yetki ve Kullanıcı Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }

  const user = JSON.parse(userStr);

  if (user.rol !== "Owner") {
    alert("Yetkisiz Giriş!");
    window.location.href = "../index.html";
    return;
  }

  await loadProperties(user);
});

// Mülkleri Yükle
async function loadProperties(user) {
  const tbody = document.getElementById("propertyList");
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#8d97ad;">Yükleniyor...</td></tr>';

  try {
    const userId = user.kullaniciID || user.KullaniciID || user.id;

    const mulkler = await API.get(`/Mulk?sahipId=${userId}`);

    globalMulkler = mulkler || [];
    tbody.innerHTML = "";

    if (globalMulkler.length > 0) {
      globalMulkler.forEach((mulk) => {
        const id = mulk.mulkID || mulk.MulkID;
        const baslik = mulk.baslik || mulk.Baslik || "Başlık Yok";
        const ilce = mulk.ilceAd || mulk.IlceAd || "-";
        const sehir = mulk.sehirAd || mulk.SehirAd || "-";
        const m2 = mulk.metrekare || mulk.Metrekare || 0;
        const oda = mulk.odaSayisi || mulk.OdaSayisi || "-";
        const tur = mulk.mulkTuruAd || mulk.MulkTuruAd || "Konut";
        const aktifMi = mulk.aktifMi !== undefined ? mulk.aktifMi : mulk.AktifMi;

        const badgeClass = aktifMi ? "active" : "passive";
        const badgeText = aktifMi ? "Aktif" : "Pasif";

        const row = `
          <tr>
            <td><strong>${baslik}</strong></td>
            <td>${ilce} / ${sehir}</td>
            <td>${m2} m²</td>
            <td>${oda}</td>
            <td>${tur}</td>
            <td><span class="badge ${badgeClass}">${badgeText}</span></td>
            <td style="white-space:nowrap;">
              <button class="action-btn btn-edit" title="Detay" onclick="viewPropertyDetail(${id})" style="margin-right:5px;">
                <i class="fa-solid fa-eye"></i> Detay
              </button>
              <button class="action-btn btn-edit" title="Düzenle" onclick="editProperty(${id})" style="margin-right:5px; background:rgba(0,212,255,0.1); color:#00d4ff;">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button class="action-btn btn-delete" title="Sil" onclick="deleteProperty(${id}, '${baslik}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
        tbody.innerHTML += row;
      });
    } else {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#8d97ad; padding:2rem;">Henüz hiç mülkünüz yok. Sağ üstten ekleyebilirsiniz.</td></tr>';
    }
  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#ff4b5c; padding:2rem;">Veriler yüklenirken hata oluştu.</td></tr>';
  }
}

// Mülk Detay Sayfasına Git
window.viewPropertyDetail = function(id) {
  window.location.href = `mulk-detay.html?id=${id}`;
};

// Mülk Düzenleme Sayfasına Git
window.editProperty = function(id) {
  window.location.href = `mulk-edit.html?id=${id}`;
};

// Mülk Sil
window.deleteProperty = async function(id, baslik) {
  if (!confirm(`"${baslik}" adlı mülkü silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`)) {
    return;
  }

  try {
    const result = await API.delete(`/Mulk/${id}`);
    
    if (result !== null && result !== undefined) {
      alert("Mülk başarıyla silindi.");
      
      // Listeyi yenile
      const userStr = localStorage.getItem("user");
      const user = JSON.parse(userStr);
      await loadProperties(user);
    } else {
      alert("Mülk silinirken bir hata oluştu.");
    }
  } catch (error) {
    alert("Mülk silinirken bir hata oluştu: " + (error.message || "Bilinmeyen hata"));
  }
};

// Çıkış Butonu
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});
