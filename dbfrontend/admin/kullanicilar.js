let globalUsers = [];
let currentFilter = 'all';

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

  await loadUsers();
});

// Filtre Değiştir
window.switchFilter = function(filter) {
  currentFilter = filter;
  
  // Tab stillerini güncelle
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');
  
  renderUsers();
};

// Kullanıcıları Yükle
async function loadUsers() {
  const tbody = document.getElementById("usersList");
  tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>Yükleniyor...</td></tr>";

  try {
    globalUsers = [];
    
    // Önce rol bazlı endpoint'leri dene
    let roleBasedSuccess = false;
    let ownersCount = 0;
    let tenantsCount = 0;
    let adminsCount = 0;
    
    try {
      const [owners, tenants, admins] = await Promise.all([
        API.get("/Kullanici/role/Owner"),
        API.get("/Kullanici/role/Tenant"),
        API.get("/Kullanici/role/Admin")
      ]);
      
      console.log("Rol bazlı endpoint yanıtları:", { owners, tenants, admins });
      
      if (Array.isArray(owners) && owners.length > 0) {
        globalUsers = globalUsers.concat(owners.map(u => ({ ...u, rol: "Owner" })));
        ownersCount = owners.length;
        roleBasedSuccess = true;
        console.log("Owner'lar yüklendi:", owners.length);
      } else {
        console.log("Owner'lar boş veya array değil");
      }
      
      if (Array.isArray(tenants) && tenants.length > 0) {
        globalUsers = globalUsers.concat(tenants.map(u => ({ ...u, rol: "Tenant" })));
        tenantsCount = tenants.length;
        roleBasedSuccess = true;
        console.log("Tenant'lar yüklendi:", tenants.length);
      } else {
        console.log("Tenant'lar boş veya array değil");
      }
      
      if (Array.isArray(admins) && admins.length > 0) {
        globalUsers = globalUsers.concat(admins.map(u => ({ ...u, rol: "Admin" })));
        adminsCount = admins.length;
        roleBasedSuccess = true;
        console.log("Admin'ler yüklendi:", admins.length);
      } else {
        console.log("Admin'ler boş veya array değil");
      }
      
      // Eğer tüm roller başarılı bir şekilde yüklendiyse ve Owner'lar da varsa, kullan
      if (roleBasedSuccess && globalUsers.length > 0 && ownersCount > 0) {
        console.log("Rol bazlı endpoint'lerden kullanıcılar yüklendi - Toplam:", globalUsers.length, "Owner:", ownersCount, "Tenant:", tenantsCount, "Admin:", adminsCount);
        renderUsers();
        return;
      } else if (roleBasedSuccess && globalUsers.length > 0) {
        // Eğer Owner'lar yoksa ama diğerleri varsa, fallback'e geç
        console.log("Owner'lar bulunamadı, fallback mekanizmasına geçiliyor...");
        globalUsers = []; // Temizle, fallback'te tekrar yüklenecek
      }
    } catch (roleError) {
      console.log("Rol bazlı endpoint'ler başarısız:", roleError);
    }
    
    // Fallback: Tüm kullanıcıları çek ve rolleriyle eşleştir
    console.log("Tüm kullanıcılar çekiliyor...");
    const allUsers = await API.get("/Kullanici");
    console.log("Tüm kullanıcılar çekildi:", allUsers);
    
    if (!Array.isArray(allUsers) || allUsers.length === 0) {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:#888; padding:2rem;'>Henüz kullanıcı bulunmuyor.</td></tr>";
      return;
    }
    
    // Mülk sahiplerini bulmak için mülkleri de çek
    console.log("Mülk sahiplerini bulmak için mülkler çekiliyor...");
    let mulkSahipleri = new Set(); // Mülk sahibi kullanıcı ID'leri
    try {
      const mulkler = await API.get("/Mulk");
      console.log("Mülkler çekildi:", mulkler);
      
      if (Array.isArray(mulkler) && mulkler.length > 0) {
        mulkler.forEach(m => {
          const sahipID = m.sahipKullaniciID || m.SahipKullaniciID || m.sahipID || m.SahipID;
          if (sahipID) {
            // Hem string hem number olarak ekle (eşleşme için)
            mulkSahipleri.add(sahipID);
            mulkSahipleri.add(parseInt(sahipID));
            mulkSahipleri.add(String(sahipID));
          }
        });
        console.log("Mülk sahibi ID'leri bulundu:", Array.from(mulkSahipleri));
      }
    } catch (mulkError) {
      console.error("Mülkler çekilirken hata:", mulkError);
    }
    
    // Tüm kullanıcı rolleri için paralel istekler
    const userRolePromises = allUsers.map(async (user) => {
      const userId = user.kullaniciID || user.KullaniciID;
      if (!userId) {
        return { ...user, rol: "Tenant" };
      }
      
      // Önce mülk sahibi kontrolü yap (daha hızlı) - hem string hem number olarak kontrol et
      const userIdNum = parseInt(userId);
      const userIdStr = String(userId);
      if (mulkSahipleri.has(userId) || mulkSahipleri.has(userIdNum) || mulkSahipleri.has(userIdStr)) {
        console.log(`Kullanıcı ${userId} (${user.adSoyad || user.AdSoyad}) mülk sahibi olarak tespit edildi`);
        return { ...user, rol: "Owner" };
      }
      
      try {
        const userRoles = await API.get(`/KullaniciRol/user/${userId}`);
        console.log(`Kullanıcı ${userId} (${user.adSoyad || user.AdSoyad}) rolleri:`, userRoles);
        
        // Rolleri kontrol et ve en yüksek öncelikli rolü al (Admin > Owner > Tenant)
        let userRole = "Tenant"; // Varsayılan
        if (Array.isArray(userRoles) && userRoles.length > 0) {
          // Backend string array döndürüyor mu kontrol et (örn: ['Owner'])
          const firstItem = userRoles[0];
          let roleNames = [];
          
          if (typeof firstItem === 'string') {
            // Direkt string array ise
            roleNames = userRoles.filter(r => r && typeof r === 'string' && r.trim() !== "");
            console.log(`  - String array olarak geldi, rol adları:`, roleNames);
          } else {
            // Obje array ise
            roleNames = userRoles.map(ur => {
              // Farklı veri yapılarını kontrol et
              const rol = ur.rol || ur.Rol || ur;
              const rolAdi = rol.rolAdi || rol.RolAdi || rol.rolAd || rol.RolAd || ur.rolAdi || ur.RolAdi || "";
              console.log(`  - Rol objesi:`, rol, `Rol adı:`, rolAdi);
              return rolAdi;
            }).filter(r => r && r.trim() !== ""); // Boş olanları filtrele
            console.log(`  - Obje array olarak geldi, rol adları:`, roleNames);
          }
          
          console.log(`  - Tüm rol adları:`, roleNames);
          
          // Büyük/küçük harf duyarsız kontrol
          const roleNamesLower = roleNames.map(r => r.toLowerCase());
          
          if (roleNamesLower.includes("admin")) {
            userRole = "Admin";
            console.log(`  -> Kullanıcı Admin olarak işaretlendi`);
          } else if (roleNamesLower.includes("owner") || roleNamesLower.includes("mülk sahibi")) {
            userRole = "Owner";
            console.log(`  -> Kullanıcı Owner olarak işaretlendi`);
          } else if (roleNamesLower.includes("tenant") || roleNamesLower.includes("kiracı")) {
            userRole = "Tenant";
            console.log(`  -> Kullanıcı Tenant olarak işaretlendi`);
          } else {
            console.log(`  -> Rol eşleşmedi, varsayılan Tenant kullanılıyor`);
          }
        } else {
          console.log(`  -> Kullanıcının rolü yok, varsayılan Tenant kullanılıyor`);
        }
        
        return { ...user, rol: userRole };
      } catch (roleError) {
        console.error(`Kullanıcı ${userId} rolü alınamadı:`, roleError);
        return { ...user, rol: "Tenant" };
      }
    });
    
    // Tüm rolleri bekle
    globalUsers = await Promise.all(userRolePromises);
    console.log("Tüm kullanıcılar rolleriyle eşleştirildi:", globalUsers.length);
    
    // Rol dağılımını logla
    const roleCounts = {
      Owner: globalUsers.filter(u => u.rol === "Owner").length,
      Tenant: globalUsers.filter(u => u.rol === "Tenant").length,
      Admin: globalUsers.filter(u => u.rol === "Admin").length
    };
    console.log("Rol dağılımı:", roleCounts);
    console.log("Owner kullanıcılar:", globalUsers.filter(u => u.rol === "Owner").map(u => ({
      adSoyad: u.adSoyad || u.AdSoyad,
      kullaniciID: u.kullaniciID || u.KullaniciID
    })));

    if (globalUsers.length === 0) {
      tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:#888; padding:2rem;'>Henüz kullanıcı bulunmuyor.</td></tr>";
    } else {
      renderUsers();
    }
  } catch (error) {
    console.error("Kullanıcılar yüklenirken genel hata:", error);
    tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:#ff4b5c;'>Veri yüklenirken hata oluştu: " + (error.message || "Bilinmeyen hata") + "</td></tr>";
  }
}

// Kullanıcıları Render Et
function renderUsers() {
  const tbody = document.getElementById("usersList");
  if (!tbody) {
    console.error("usersList elementi bulunamadı!");
    return;
  }
  
  console.log("renderUsers çağrıldı, currentFilter:", currentFilter);
  console.log("globalUsers sayısı:", globalUsers.length);
  console.log("globalUsers rolleri:", globalUsers.map(u => ({ ad: u.adSoyad || u.AdSoyad, rol: u.rol })));
  
  // Filtrele
  let filteredUsers = globalUsers;
  if (currentFilter !== 'all') {
    filteredUsers = globalUsers.filter(u => {
      const userRol = u.rol || "";
      const match = userRol === currentFilter;
      console.log(`Kullanıcı ${u.adSoyad || u.AdSoyad} - Rol: ${userRol}, Filter: ${currentFilter}, Match: ${match}`);
      return match;
    });
  }
  
  console.log("Filtrelenmiş kullanıcı sayısı:", filteredUsers.length);

  if (filteredUsers.length > 0) {
    tbody.innerHTML = "";
    filteredUsers.forEach(u => {
      const adSoyad = u.adSoyad || u.AdSoyad || "-";
      const email = u.email || u.Email || "-";
      const telefon = u.telefon || u.Telefon || "-";
      const rol = u.rol || "-";
      const aktifMi = u.aktifMi !== undefined ? u.aktifMi : u.AktifMi;
      const olusturmaTarihi = u.olusturmaTarihi || u.OlusturmaTarihi;
      const tarih = olusturmaTarihi ? new Date(olusturmaTarihi).toLocaleDateString("tr-TR") : "-";

      const rolColor = rol === "Owner" ? "#00d4ff" : rol === "Tenant" ? "#00c853" : "#ff6b6b";
      const rolBg = rol === "Owner" ? "rgba(0,212,255,0.1)" : rol === "Tenant" ? "rgba(0,200,83,0.1)" : "rgba(255,107,107,0.1)";

      const row = `
        <tr>
          <td style="font-weight:600;">${adSoyad}</td>
          <td>${email}</td>
          <td>${telefon || "-"}</td>
          <td><span style="background:${rolBg}; color:${rolColor}; padding:4px 10px; border-radius:15px; font-size:0.85rem; font-weight:600;">${rol}</span></td>
          <td><span style="background:${aktifMi ? "rgba(0,200,83,0.1)" : "rgba(255,75,92,0.1)"}; color:${aktifMi ? "#00c853" : "#ff4b5c"}; padding:4px 10px; border-radius:15px; font-size:0.85rem;">${aktifMi ? "Aktif" : "Pasif"}</span></td>
          <td>${tarih}</td>
          <td>
            <button onclick="toggleUserStatus(${u.kullaniciID || u.KullaniciID}, ${!aktifMi})" class="action-btn ${aktifMi ? 'btn-delete' : 'btn-edit'}" title="${aktifMi ? 'Pasife Al' : 'Aktif Et'}">
              <i class="fa-solid fa-${aktifMi ? 'ban' : 'check'}"></i>
            </button>
          </td>
        </tr>
      `;
      tbody.innerHTML += row;
    });
  } else {
    tbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:#888; padding:2rem;'>Kullanıcı bulunamadı.</td></tr>";
  }
}

// Kullanıcı Durumunu Değiştir
window.toggleUserStatus = async function(userId, newStatus) {
  if (!confirm(`${newStatus ? 'Aktif' : 'Pasif'} etmek istediğinize emin misiniz?`)) {
    return;
  }

  try {
    const result = await API.put(`/Kullanici/${userId}`, { aktifMi: newStatus });
    if (result !== null && result !== undefined) {
      alert(`Kullanıcı ${newStatus ? 'aktif' : 'pasif'} edildi.`);
      await loadUsers();
    }
  } catch (error) {
    console.error("Kullanıcı durumu güncellenirken hata:", error);
    alert("İşlem başarısız: " + (error.message || "Bilinmeyen hata"));
  }
};

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});

