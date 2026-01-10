document.addEventListener("DOMContentLoaded", async () => {
  // Yetki Kontrolü
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

  await loadContracts();
});

async function loadContracts() {
  const tbody = document.getElementById("contractsList");
  if (!tbody) {
    return;
  }
  
      tbody.innerHTML = "<tr><td colspan='8' style='text-align:center;'>Yükleniyor...</td></tr>";

  try {
    // Admin için tüm sözleşmeleri çek
    const user = JSON.parse(localStorage.getItem("user"));
    let contracts = await API.get(`/KiraSozlesme?userId=${user.kullaniciID}&role=Admin`);
    
    // Eğer boş veya null gelirse, alternatif yöntem dene
    if (!contracts || (Array.isArray(contracts) && contracts.length === 0)) {
      // Tüm kullanıcıları çekip, her birinin sözleşmelerini topla
      try {
        const allUsers = await API.get("/Kullanici");
        
        if (Array.isArray(allUsers) && allUsers.length > 0) {
          const allContracts = [];
          
          // Her kullanıcı için sözleşmeleri çek (Owner ve Tenant rolleri için)
          for (const userItem of allUsers) {
            const userId = userItem.kullaniciID || userItem.KullaniciID;
            if (userId) {
              try {
                // Owner rolü için
                const ownerContracts = await API.get(`/KiraSozlesme?userId=${userId}&role=Owner`);
                if (Array.isArray(ownerContracts)) {
                  allContracts.push(...ownerContracts);
                }
                
                // Tenant rolü için
                const tenantContracts = await API.get(`/KiraSozlesme?userId=${userId}&role=Tenant`);
                if (Array.isArray(tenantContracts)) {
                  allContracts.push(...tenantContracts);
                }
              } catch (userContractError) {
                // Kullanıcı sözleşmeleri alınamadı
              }
            }
          }
          
          // Tekrarları kaldır (aynı sözleşme ID'sine sahip olanlar)
          const uniqueContracts = [];
          const seenIds = new Set();
          allContracts.forEach(c => {
            const id = c.kiraSozlesmeID || c.KiraSozlesmeID;
            if (id && !seenIds.has(id)) {
              seenIds.add(id);
              uniqueContracts.push(c);
            }
          });
          
          contracts = uniqueContracts;
        }
      } catch (altError) {
        // Alternatif yöntem başarısız
      }
    }

    if (Array.isArray(contracts) && contracts.length > 0) {
      tbody.innerHTML = "";
      contracts.forEach((c, index) => {
        const sozlesmeNo = c.sozlesmeNo || c.SozlesmeNo || "-";
        const mulkBaslik = c.mulkBaslik || c.MulkBaslik || "-";
        const mulkSahibi = c.mulkSahibiAd || c.MulkSahibiAd || c.mulkSahibiAdSoyad || c.MulkSahibiAdSoyad || "-";
        const kiraci = c.kiraciAdSoyad || c.KiraciAdSoyad || "-";
        const aylikKira = c.aylikKiraTutar || c.AylikKiraTutar || 0;
        const paraBirimi = c.paraBirimiKod || c.ParaBirimiKod || "TRY";
        const baslangic = c.baslangicTarihi || c.BaslangicTarihi;
        const bitis = c.bitisTarihi || c.BitisTarihi;
        const aktifMi = c.aktifMi !== undefined ? c.aktifMi : c.AktifMi;

        const baslangicStr = baslangic ? new Date(baslangic).toLocaleDateString("tr-TR") : "-";
        const bitisStr = bitis ? new Date(bitis).toLocaleDateString("tr-TR") : "Süresiz";
        
        const currencySymbol = paraBirimi === "TRY" ? "₺" : paraBirimi === "USD" ? "$" : paraBirimi === "EUR" ? "€" : paraBirimi;

        const row = `
          <tr>
            <td style="font-weight:600;">${sozlesmeNo}</td>
            <td>${mulkBaslik}</td>
            <td>${mulkSahibi}</td>
            <td>${kiraci}</td>
            <td>${parseFloat(aylikKira).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${currencySymbol}</td>
            <td>${baslangicStr}</td>
            <td>${bitisStr}</td>
            <td><span style="background:${aktifMi ? "rgba(0,200,83,0.1)" : "rgba(255,75,92,0.1)"}; color:${aktifMi ? "#00c853" : "#ff4b5c"}; padding:4px 10px; border-radius:15px; font-size:0.85rem;">${aktifMi ? "Aktif" : "Pasif"}</span></td>
          </tr>
        `;
        tbody.innerHTML += row;
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='8' style='text-align:center; color:#888; padding:2rem;'>Sözleşme bulunamadı.</td></tr>";
    }
  } catch (error) {
      tbody.innerHTML = "<tr><td colspan='8' style='text-align:center; color:#ff4b5c;'>Veri yüklenirken hata oluştu: " + (error.message || "Bilinmeyen hata") + "</td></tr>";
  }
}

document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});


