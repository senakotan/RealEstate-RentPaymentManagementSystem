document.addEventListener("DOMContentLoaded", async () => {
  // Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);
  if (user.rol !== "Admin") {
    alert("Bu sayfaya erişim yetkiniz yok.");
    window.location.href = "../index.html";
    return;
  }

  // Kullanıcı bilgilerini göster
  document.getElementById("headerUserName").innerText = user.adSoyad;
  document.getElementById("userImg").src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=ff6b6b&color=fff`;

  // Dashboard verilerini yükle
  await loadDashboardData();
  await loadRecentUsers();
  await loadRecentPayments();
});

// Dashboard İstatistikleri
async function loadDashboardData() {
  try {
    // Backend'den Admin Dashboard verilerini çek
    const dashboardData = await API.get("/Dashboard/admin");
    
    if (dashboardData) {
      // Toplam kullanıcı sayısı
      document.getElementById("totalUsers").innerText = dashboardData.toplamKullanici || dashboardData.ToplamKullanici || 0;
      
      // Toplam mülk sayısı
      document.getElementById("totalProperties").innerText = dashboardData.toplamMulk || dashboardData.ToplamMulk || 0;
      
      // Aktif sözleşmeler
      document.getElementById("activeContracts").innerText = dashboardData.aktifSozlesme || dashboardData.AktifSozlesme || 0;
      
      // Geciken ödemeler
      const gecikenEl = document.getElementById("gecikenOdemeler");
      if (gecikenEl) {
        gecikenEl.innerText = dashboardData.gecikmisOdeme || dashboardData.GecikmisOdeme || 0;
      }
    } else {
      // Fallback: Eski yöntem
      const allUsers = await API.get("/Kullanici");
      let totalUsers = 0;
      
      if (Array.isArray(allUsers)) {
        totalUsers = allUsers.filter(u => {
          const aktifMi = u.aktifMi !== undefined ? u.aktifMi : u.AktifMi;
          return aktifMi === true || aktifMi === 1;
        }).length;
      }
      
      document.getElementById("totalUsers").innerText = totalUsers;

      try {
        const properties = await API.get("/Mulk");
        const propertyCount = Array.isArray(properties) ? properties.length : 0;
        document.getElementById("totalProperties").innerText = propertyCount;
      } catch (e) {
        document.getElementById("totalProperties").innerText = "0";
      }

      document.getElementById("activeContracts").innerText = "0";
      
      // Geciken ödemeler fallback
      const gecikenEl = document.getElementById("gecikenOdemeler");
      if (gecikenEl) {
        gecikenEl.innerText = "0";
      }
    }
  } catch (error) {
    // Hata durumunda varsayılan değerler
    document.getElementById("totalUsers").innerText = "0";
    document.getElementById("totalProperties").innerText = "0";
    document.getElementById("activeContracts").innerText = "0";
  }
}

// Son Eklenen Kullanıcılar
async function loadRecentUsers() {
  const tbody = document.getElementById("recentUsers");
  try {
    // Tüm kullanıcıları çek
    const allUsers = await API.get("/Kullanici");
    
    if (!Array.isArray(allUsers) || allUsers.length === 0) {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:#888;'>Henüz kullanıcı bulunmuyor.</td></tr>";
      return;
    }

    // Rolleri çek
    const roles = await API.get("/Rol");
    const rolesMap = new Map();
    if (Array.isArray(roles)) {
      roles.forEach(r => {
        const rolID = r.rolID || r.RolID || r.id || r.ID;
        const rolAdi = (r.rolAdi || r.RolAdi || "").toLowerCase();
        if (rolID) {
          rolesMap.set(rolID, rolAdi);
        }
      });
    }

    // Her kullanıcının rollerini bul
    const usersWithRoles = await Promise.all(allUsers.map(async (user) => {
      const userId = user.kullaniciID || user.KullaniciID || user.id || user.ID;
      let userRole = "Tenant"; // Varsayılan
      
      if (userId) {
        try {
          const userRoles = await API.get(`/KullaniciRol/user/${userId}`);
          if (Array.isArray(userRoles) && userRoles.length > 0) {
            const firstItem = userRoles[0];
            let roleNames = [];
            
            if (typeof firstItem === 'string') {
              roleNames = userRoles.filter(r => r && typeof r === 'string' && r.trim() !== "");
            } else {
              roleNames = userRoles.map(ur => {
                const rol = ur.rol || ur.Rol || ur;
                const rolAdi = rol.rolAdi || rol.RolAdi || "";
                return rolAdi;
              }).filter(r => r && r.trim() !== "");
            }
            
            const roleNamesLower = roleNames.map(r => r.toLowerCase());
            if (roleNamesLower.includes("admin")) {
              userRole = "Admin";
            } else if (roleNamesLower.includes("owner")) {
              userRole = "Owner";
            } else if (roleNamesLower.includes("tenant")) {
              userRole = "Tenant";
            }
          }
        } catch (roleError) {
          // Hata sessizce yakalanıyor, varsayılan rol kullanılıyor
        }
      }
      
      return { ...user, rol: userRole };
    }));
    
    // Tarihe göre sırala (en yeni önce)
    usersWithRoles.sort((a, b) => {
      const dateA = new Date(a.kayitTarihi || a.KayitTarihi || a.olusturmaTarihi || a.OlusturmaTarihi || 0);
      const dateB = new Date(b.kayitTarihi || b.KayitTarihi || b.olusturmaTarihi || b.OlusturmaTarihi || 0);
      return dateB - dateA;
    });

    // Son 5 kullanıcıyı göster
    const recentUsers = usersWithRoles.slice(0, 5);

    if (recentUsers.length > 0) {
      tbody.innerHTML = "";
      recentUsers.forEach(u => {
        const adSoyad = u.adSoyad || u.AdSoyad || "-";
        const email = u.email || u.Email || "-";
        const rol = u.rol || "-";
        const aktifMi = u.aktifMi !== undefined ? u.aktifMi : u.AktifMi;

        const row = `
          <tr>
            <td>${adSoyad}</td>
            <td>${email}</td>
            <td><span style="background:${rol === "Owner" ? "rgba(0,212,255,0.1)" : "rgba(0,200,83,0.1)"}; color:${rol === "Owner" ? "#00d4ff" : "#00c853"}; padding:4px 10px; border-radius:15px; font-size:0.85rem;">${rol}</span></td>
            <td><span style="background:${aktifMi ? "rgba(0,200,83,0.1)" : "rgba(255,75,92,0.1)"}; color:${aktifMi ? "#00c853" : "#ff4b5c"}; padding:4px 10px; border-radius:15px; font-size:0.85rem;">${aktifMi ? "Aktif" : "Pasif"}</span></td>
          </tr>
        `;
        tbody.innerHTML += row;
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:#888;'>Henüz kullanıcı bulunmuyor.</td></tr>";
    }
  } catch (error) {
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:#ff4b5c;'>Veri yüklenirken hata oluştu.</td></tr>";
  }
}

// Son Ödemeler
async function loadRecentPayments() {
  const tbody = document.getElementById("recentPayments");
  try {
    // Önce ödemeleri çek
    const payments = await API.get("/KiraOdeme");
    
    if (!Array.isArray(payments) || payments.length === 0) {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:#888;'>Henüz ödeme bulunmuyor.</td></tr>";
      return;
    }

    // Sözleşmeleri çek (mülk ve kiracı bilgileri için)
    let contracts = [];
    let contractsMap = new Map();
    
    try {
      const allUsers = await API.get("/Kullanici");
      if (Array.isArray(allUsers) && allUsers.length > 0) {
        const contractPromises = [];
        
        for (const user of allUsers) {
          const userId = user.kullaniciID || user.KullaniciID;
          if (userId) {
            contractPromises.push(
              API.get(`/KiraSozlesme?userId=${userId}&role=Owner`).catch(() => [])
            );
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

    // Kiracıları çek
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

    // Mülkleri çek
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

    // Kullanıcıları çek
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

    // Tarihe göre sırala (en yeni önce)
    const sortedPayments = [...payments].sort((a, b) => {
      const dateA = new Date(a.olusturmaTarihi || a.OlusturmaTarihi || 0);
      const dateB = new Date(b.olusturmaTarihi || b.OlusturmaTarihi || 0);
      return dateB - dateA;
    });

    // Son 5 ödemeyi göster
    const recentPayments = sortedPayments.slice(0, 5);

    tbody.innerHTML = "";
    recentPayments.forEach(p => {
      const sozlesmeID = p.kiraSozlesmeID || p.KiraSozlesmeID;
      const contract = contractsMap.get(sozlesmeID);
      
      // Mülk bilgisi
      let mulk = "-";
      if (contract) {
        mulk = contract.mulkBaslik || contract.MulkBaslik || contract.mulk || contract.Mulk || "-";
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
      }

      const tutar = p.tutar || p.Tutar || 0;
      
      // Para birimi
      let paraBirimi = "TRY";
      if (contract) {
        paraBirimi = contract.paraBirimiKod || contract.ParaBirimiKod || "TRY";
      }
      
      // Ödeme durumu
      const vadeTarihi = p.vadeTarihi || p.VadeTarihi;
      const odemeTarihi = p.odemeTarihi || p.OdemeTarihi;
      let durum = "Pending";
      if (odemeTarihi) {
        durum = "Paid";
      } else if (vadeTarihi && new Date(vadeTarihi) < new Date()) {
        durum = "Late";
      } else {
        durum = p.durum || p.Durum || p.odemeDurum || p.OdemeDurum || "Pending";
      }

      const durumText = durum === "Paid" || durum === "paid" ? "Ödendi" : durum === "Late" || durum === "late" ? "Gecikmiş" : "Bekliyor";
      const durumColor = durum === "Paid" || durum === "paid" ? "#00c853" : durum === "Late" || durum === "late" ? "#ff4b5c" : "#ffa726";
      const durumBg = durum === "Paid" || durum === "paid" ? "rgba(0,200,83,0.1)" : durum === "Late" || durum === "late" ? "rgba(255,75,92,0.1)" : "rgba(255,167,38,0.1)";

      const currencySymbol = paraBirimi === "TRY" ? "₺" : paraBirimi === "USD" ? "$" : paraBirimi === "EUR" ? "€" : paraBirimi;
      const formattedAmount = parseFloat(tutar).toLocaleString('tr-TR', {minimumFractionDigits: 2, maximumFractionDigits: 2});

      const row = `
        <tr>
          <td>${mulk}</td>
          <td>${kiraci}</td>
          <td>${formattedAmount} ${currencySymbol}</td>
          <td><span style="background:${durumBg}; color:${durumColor}; padding:4px 10px; border-radius:15px; font-size:0.85rem;">${durumText}</span></td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  } catch (error) {
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center; color:#ff4b5c;'>Veri yüklenirken hata oluştu.</td></tr>";
  }
}

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});

