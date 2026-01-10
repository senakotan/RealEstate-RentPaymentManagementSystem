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

  await loadPayments();
});

async function loadPayments() {
  const tbody = document.getElementById("paymentsList");
  tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>Yükleniyor...</td></tr>";

  try {
    // Önce ödemeleri çek
    const payments = await API.get("/KiraOdeme");
    
    if (!Array.isArray(payments) || payments.length === 0) {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:#888; padding:2rem;'>Ödeme bulunamadı.</td></tr>";
      return;
    }

    // Sözleşmeleri çek (mülk ve kiracı bilgileri için)
    // Backend parametresiz çağrıyı kabul etmiyor, direkt kullanıcı bazlı çekiyoruz
    let contracts = [];
    let contractsMap = new Map();
    
    try {
      // Tüm kullanıcıları çek ve her biri için sözleşmeleri çek
      const allUsers = await API.get("/Kullanici");
      if (Array.isArray(allUsers) && allUsers.length > 0) {
        const contractPromises = [];
        
        for (const user of allUsers) {
          const userId = user.kullaniciID || user.KullaniciID;
          if (userId) {
            // Owner rolü için
            contractPromises.push(
              API.get(`/KiraSozlesme?userId=${userId}&role=Owner`).catch(() => [])
            );
            // Tenant rolü için
            contractPromises.push(
              API.get(`/KiraSozlesme?userId=${userId}&role=Tenant`).catch(() => [])
            );
          }
        }
        
        const contractResults = await Promise.all(contractPromises);
        const allContracts = [];
        const seenIds = new Set();
        
        contractResults.forEach(result => {
          if (Array.isArray(result)) {
            result.forEach(c => {
              const sozlesmeID = c.kiraSozlesmeID || c.KiraSozlesmeID;
              if (sozlesmeID && !seenIds.has(sozlesmeID)) {
                seenIds.add(sozlesmeID);
                allContracts.push(c);
                contractsMap.set(sozlesmeID, c);
              }
            });
          }
        });
        
        contracts = allContracts;
      }
    } catch (error) {
      // Sessiz hata yönetimi
    }

    // Kiracıları çek (kiracı adı için)
    let tenants = [];
    const tenantsMap = new Map();
    
    try {
      tenants = await API.get("/Kiraci");
      if (Array.isArray(tenants)) {
        tenants.forEach(t => {
          const kiraciID = t.kiraciID || t.KiraciID;
          if (kiraciID) {
            tenantsMap.set(kiraciID, t);
          }
        });
      }
    } catch (error) {
      // Sessiz hata yönetimi
    }

    // Mülkleri çek (mülk sahibi bilgisi için)
    let mulkler = [];
    const mulklerMap = new Map();
    
    try {
      mulkler = await API.get("/Mulk");
      if (Array.isArray(mulkler)) {
        mulkler.forEach(m => {
          const mulkID = m.mulkID || m.MulkID;
          if (mulkID) {
            mulklerMap.set(mulkID, m);
          }
        });
      }
    } catch (error) {
      // Sessiz hata yönetimi
    }

    // Kullanıcıları çek (mülk sahibi adı için)
    let allUsers = [];
    const usersMap = new Map();
    
    try {
      allUsers = await API.get("/Kullanici");
      if (Array.isArray(allUsers)) {
        allUsers.forEach(u => {
          const userId = u.kullaniciID || u.KullaniciID || u.id || u.ID;
          if (userId) {
            usersMap.set(userId, u);
          }
        });
      }
    } catch (error) {
      // Sessiz hata yönetimi
    }

    // Ödemeleri sırala (en yeni önce)
    payments.sort((a, b) => {
      const dateA = new Date(a.olusturmaTarihi || a.OlusturmaTarihi || a.vadeTarihi || a.VadeTarihi || 0);
      const dateB = new Date(b.olusturmaTarihi || b.OlusturmaTarihi || b.vadeTarihi || b.VadeTarihi || 0);
      return dateB - dateA;
    });

    tbody.innerHTML = "";
    payments.forEach(p => {
      const sozlesmeID = p.kiraSozlesmeID || p.KiraSozlesmeID;
      const contract = contractsMap.get(sozlesmeID);
      
      // Mülk bilgisi
      let mulk = "-";
      if (contract) {
        mulk = contract.mulkBaslik || contract.MulkBaslik || contract.mulk || contract.Mulk || "-";
      } else {
        // Direkt ödeme verisinden dene
        mulk = p.mulkBaslik || p.MulkBaslik || p.mulk || p.Mulk || "-";
      }

      // Kiracı bilgisi
      let kiraci = "-";
      if (contract) {
        const kiraciID = contract.kiraciID || contract.KiraciID;
        const tenant = tenantsMap.get(kiraciID);
        if (tenant) {
          kiraci = tenant.adSoyad || tenant.AdSoyad || "-";
        } else {
          kiraci = contract.kiraciAdSoyad || contract.KiraciAdSoyad || contract.kiraci || contract.Kiraci || "-";
        }
      } else {
        // Direkt ödeme verisinden dene
        kiraci = p.kiraciAdSoyad || p.KiraciAdSoyad || p.kiraci || p.Kiraci || "-";
      }

      // Mülk sahibi bilgisi
      let mulkSahibi = "-";
      if (contract) {
        // Önce sözleşmeden direkt al (SozlesmeDetayDto formatında mulkSahibiAd var)
        mulkSahibi = contract.mulkSahibiAd || contract.MulkSahibiAd || contract.sahipAd || contract.SahipAd || "-";
        
        // Eğer hala bulunamadıysa, mülk bilgisinden al
        if (mulkSahibi === "-") {
          const mulkID = contract.mulkID || contract.MulkID;
          const mulk = mulklerMap.get(mulkID);
          if (mulk) {
            // MulkDetayDto formatında sahipAdSoyad var
            mulkSahibi = mulk.sahipAdSoyad || mulk.SahipAdSoyad || "-";
            
            // Eğer hala yoksa, sahipKullaniciID ile kullanıcı tablosundan bul
            if (mulkSahibi === "-") {
              const sahipKullaniciID = mulk.sahipKullaniciID || mulk.SahipKullaniciID || mulk.sahipID || mulk.SahipID;
              if (sahipKullaniciID) {
                const owner = usersMap.get(sahipKullaniciID);
                if (owner) {
                  mulkSahibi = owner.adSoyad || owner.AdSoyad || "-";
                }
              }
            }
          }
        }
      }

      const vadeTarihi = p.vadeTarihi || p.VadeTarihi;
      const odemeTarihi = p.odemeTarihi || p.OdemeTarihi;
      const tutar = p.tutar || p.Tutar || 0;
      
      // Para birimi
      let paraBirimi = "TRY";
      if (contract) {
        paraBirimi = contract.paraBirimiKod || contract.ParaBirimiKod || "TRY";
      } else {
        paraBirimi = p.paraBirimiKod || p.ParaBirimiKod || "TRY";
      }
      
      // Ödeme durumu
      let durum = "Pending";
      if (odemeTarihi) {
        durum = "Paid";
      } else if (vadeTarihi && new Date(vadeTarihi) < new Date()) {
        durum = "Late";
      } else {
        durum = p.durum || p.Durum || p.odemeDurum || p.OdemeDurum || "Pending";
      }

      const vadeStr = vadeTarihi ? new Date(vadeTarihi).toLocaleDateString("tr-TR") : "-";
      const odemeStr = odemeTarihi ? new Date(odemeTarihi).toLocaleDateString("tr-TR") : "-";

      const durumText = durum === "Paid" || durum === "paid" ? "Ödendi" : durum === "Late" || durum === "late" ? "Gecikmiş" : "Bekliyor";
      const durumColor = durum === "Paid" || durum === "paid" ? "#00c853" : durum === "Late" || durum === "late" ? "#ff4b5c" : "#ffa726";
      const durumBg = durum === "Paid" || durum === "paid" ? "rgba(0,200,83,0.1)" : durum === "Late" || durum === "late" ? "rgba(255,75,92,0.1)" : "rgba(255,167,38,0.1)";

      const currencySymbol = paraBirimi === "TRY" ? "₺" : paraBirimi === "USD" ? "$" : paraBirimi === "EUR" ? "€" : paraBirimi;
      const formattedAmount = parseFloat(tutar).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

      const row = `
        <tr>
          <td>${mulk}</td>
          <td>${mulkSahibi}</td>
          <td>${kiraci}</td>
          <td>${vadeStr}</td>
          <td>${formattedAmount} ${currencySymbol}</td>
          <td>${odemeStr}</td>
          <td><span style="background:${durumBg}; color:${durumColor}; padding:4px 10px; border-radius:15px; font-size:0.85rem;">${durumText}</span></td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  } catch (error) {
    tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:#ff4b5c;'>Veri yüklenirken hata oluştu.</td></tr>";
  }
}

document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});


