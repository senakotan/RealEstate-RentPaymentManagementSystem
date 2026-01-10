document.addEventListener("DOMContentLoaded", async () => {
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);
  if (user.rol !== "Admin") {
    window.location.href = "../index.html";
    return;
  }

  await loadProperties();
});

async function loadProperties() {
  const tbody = document.getElementById("propertiesList");
      tbody.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Yükleniyor...</td></tr>";

  try {
    const properties = await API.get("/Mulk");

    if (Array.isArray(properties) && properties.length > 0) {
      tbody.innerHTML = "";
      properties.forEach(p => {
        const baslik = p.baslik || p.Baslik || "-";
        const adres = p.adres || p.Adres || "-";
        const sahipAd = p.sahipAdSoyad || p.SahipAdSoyad || "-";
        const tip = p.mulkTip || p.MulkTip || "-";
        const aktifMi = p.aktifMi !== undefined ? p.aktifMi : p.AktifMi;

        const id = p.mulkID || p.MulkID;
        const row = `
          <tr>
            <td style="font-weight:600;">${baslik}</td>
            <td>${adres}</td>
            <td>${sahipAd}</td>
            <td>${tip}</td>
            <td><span style="background:${aktifMi ? "rgba(0,200,83,0.1)" : "rgba(255,75,92,0.1)"}; color:${aktifMi ? "#00c853" : "#ff4b5c"}; padding:4px 10px; border-radius:15px; font-size:0.85rem;">${aktifMi ? "Aktif" : "Pasif"}</span></td>
            <td style="white-space:nowrap;">
              <button onclick="viewPropertyDetail(${id})" class="action-btn btn-edit" title="Detay">
                <i class="fa-solid fa-eye"></i>
              </button>
            </td>
          </tr>
        `;
        tbody.innerHTML += row;
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:#888; padding:2rem;'>Mülk bulunamadı.</td></tr>";
    }
  } catch (error) {
    console.error("Mülkler yüklenirken hata:", error);
      tbody.innerHTML = "<tr><td colspan='6' style='text-align:center; color:#ff4b5c;'>Veri yüklenirken hata oluştu.</td></tr>";
  }
}

window.viewPropertyDetail = function(id) {
  window.location.href = `mulk-detay.html?id=${id}`;
};

document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});


