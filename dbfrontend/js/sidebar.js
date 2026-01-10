// Sidebar Yönetimi - Tüm sistemler için ortak
document.addEventListener("DOMContentLoaded", () => {
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }

  const user = JSON.parse(userStr);
  const role = user.rol || "Owner";
  
  // Sidebar HTML'ini oluştur
  const sidebarHTML = generateSidebar(role);
  
  // Mevcut sidebar'ı bul ve değiştir
  const existingSidebar = document.querySelector(".sidebar");
  if (existingSidebar) {
    existingSidebar.innerHTML = sidebarHTML;
  } else {
    // Sidebar yoksa oluştur
    const sidebarDiv = document.createElement("div");
    sidebarDiv.className = "sidebar";
    sidebarDiv.innerHTML = sidebarHTML;
    document.body.insertBefore(sidebarDiv, document.body.firstChild);
  }

  // Aktif sayfayı işaretle
  highlightActivePage();
  
  // Çıkış butonunu dinle
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", (e) => {
      e.preventDefault();
      if (confirm("Çıkış yapmak istediğinize emin misiniz?")) {
        localStorage.removeItem("user");
        window.location.href = "../index.html";
      }
    });
  }
});

function generateSidebar(role) {
  let logoHTML = '';
  let menuItems = [];

  if (role === "Admin") {
    logoHTML = '<h2>Admin<span>Panel</span></h2>';
    menuItems = [
      { href: "dashboard.html", icon: "fa-chart-line", text: "Dashboard" },
      { href: "kullanicilar.html", icon: "fa-users", text: "Tüm Kullanıcılar" },
      { href: "admin-ekle.html", icon: "fa-user-shield", text: "Admin Ekle" },
      { href: "sozlesmeler.html", icon: "fa-file-contract", text: "Tüm Sözleşmeler" },
      { href: "odemeler.html", icon: "fa-wallet", text: "Tüm Ödemeler" },
      { href: "mulkler.html", icon: "fa-building", text: "Tüm Mülkler" },
      { href: "banka.html", icon: "fa-building-columns", text: "Banka Yönetimi" },
      { href: "kiracilar.html", icon: "fa-user-tie", text: "Tüm Kiracılar" },
      { href: "bildirimler.html", icon: "fa-bell", text: "Bildirimler", badge: true },
      { href: "profil.html", icon: "fa-user-gear", text: "Profilim" }
    ];
  } else if (role === "Tenant") {
    logoHTML = '<h2>Evim<span>Panel</span></h2>';
    menuItems = [
      { href: "dashboard.html", icon: "fa-house-user", text: "Ev Durumu" },
      { href: "sozlesmeler.html", icon: "fa-file-contract", text: "Sözleşmelerim" },
      { href: "odemeler.html", icon: "fa-receipt", text: "Ödemelerim" },
      { href: "ariza.html", icon: "fa-triangle-exclamation", text: "Arıza Bildir" },
      { href: "bildirimler.html", icon: "fa-bell", text: "Bildirimler", badge: true },
      { href: "profil.html", icon: "fa-user-gear", text: "Profilim" }
    ];
  } else {
    // Owner (varsayılan)
    logoHTML = '<h2>Emlak<span>Yönetim</span></h2>';
    menuItems = [
      { href: "dashboard.html", icon: "fa-chart-line", text: "Dashboard" },
      { href: "mulkler.html", icon: "fa-building", text: "Mülklerim" },
      { href: "sozlesmeler.html", icon: "fa-file-contract", text: "Sözleşmeler" },
      { href: "kiracilar.html", icon: "fa-users", text: "Kiracılar" },
      { href: "finans.html", icon: "fa-wallet", text: "Finans" },
      { href: "bakim.html", icon: "fa-screwdriver-wrench", text: "Talepler" },
      { href: "bildirimler.html", icon: "fa-bell", text: "Bildirimler", badge: true },
      { href: "hatirlaticilar.html", icon: "fa-bell", text: "Hatırlatıcılar" },
      { href: "profil.html", icon: "fa-user-gear", text: "Profilim" }
    ];
  }

  let menuHTML = menuItems.map(item => {
    const badgeHTML = item.badge 
      ? ' <span id="notificationBadge" style="display:none; background:#ff4b5c; color:#fff; border-radius:10px; padding:2px 6px; font-size:0.7rem; margin-left:5px;">0</span>'
      : '';
    return `<li><a href="${item.href}"><i class="fa-solid ${item.icon}"></i> ${item.text}${badgeHTML}</a></li>`;
  }).join('');

  return `
    <div class="logo">
      ${logoHTML}
    </div>
    <ul>
      ${menuHTML}
      <li class="logout">
        <a href="#" id="btnLogout"><i class="fa-solid fa-right-from-bracket"></i> Çıkış Yap</a>
      </li>
    </ul>
  `;
}

function highlightActivePage() {
  const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
  const menuItems = document.querySelectorAll('.sidebar ul li a');
  
  menuItems.forEach(item => {
    const href = item.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'dashboard.html')) {
      item.parentElement.classList.add('active');
    } else {
      item.parentElement.classList.remove('active');
    }
  });
}

