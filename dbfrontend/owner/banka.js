// Global değişkenler
let globalBanks = [];
let filteredBanks = [];

document.addEventListener("DOMContentLoaded", async () => {
  // Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);
  
  if (user.rol !== "Owner") {
    alert("Bu sayfaya sadece mülk sahipleri erişebilir.");
    window.location.href = "../index.html";
    return;
  }

  // Header bilgilerini güncelle
  const headerUserNameEl = document.getElementById("headerUserName");
  if (headerUserNameEl) headerUserNameEl.innerText = user.adSoyad;

  const userImgEl = document.getElementById("userImg");
  if (userImgEl) {
    userImgEl.src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=00d4ff&color=fff`;
  }
  
  // Bildirim badge'ini güncelle
  if (typeof updateNotificationBadge === 'function') {
    updateNotificationBadge();
  }

  // Bankaları yükle
  await loadBanks();
});

// Bankaları Yükle
async function loadBanks() {
  const tableBody = document.getElementById("bankTableBody");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const bankTable = document.getElementById("bankTable");
  const emptyState = document.getElementById("emptyState");

  loadingSpinner.style.display = "block";
  bankTable.style.display = "none";
  emptyState.style.display = "none";

  try {
    const banks = await API.get("/Banka");
    
    loadingSpinner.style.display = "none";

    if (banks && banks.length > 0) {
      // Alfabetik sırala
      globalBanks = banks.sort((a, b) => {
        const nameA = (a.bankaAdi || a.BankaAdi || "").toLowerCase();
        const nameB = (b.bankaAdi || b.BankaAdi || "").toLowerCase();
        return nameA.localeCompare(nameB, "tr");
      });
      
      filteredBanks = [...globalBanks];
      renderBanks();
    } else {
      emptyState.style.display = "block";
    }
  } catch (error) {
    loadingSpinner.style.display = "none";
    showMessage("Banka listesi yüklenirken hata oluştu.", "error");
  }
}

// Bankaları Render Et
function renderBanks() {
  const tableBody = document.getElementById("bankTableBody");
  const bankTable = document.getElementById("bankTable");
  const emptyState = document.getElementById("emptyState");

  tableBody.innerHTML = "";

  if (filteredBanks.length > 0) {
    filteredBanks.forEach((bank) => {
      const adi = bank.bankaAdi || bank.BankaAdi || "-";
      const aciklama = bank.aciklama || bank.Aciklama || "-";

      const row = `
                <tr>
                    <td style="font-weight: 600;">${adi}</td>
                    <td style="color: #8d97ad;">${aciklama}</td>
                </tr>
            `;
      tableBody.innerHTML += row;
    });

    bankTable.style.display = "table";
    emptyState.style.display = "none";
  } else {
    bankTable.style.display = "none";
    emptyState.style.display = "block";
  }
}

// Arama Filtreleme
window.filterBanks = function() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase().trim();
  
  if (searchTerm === "") {
    filteredBanks = [...globalBanks];
  } else {
    filteredBanks = globalBanks.filter(bank => {
      const adi = (bank.bankaAdi || bank.BankaAdi || "").toLowerCase();
      const aciklama = (bank.aciklama || bank.Aciklama || "").toLowerCase();
      return adi.includes(searchTerm) || aciklama.includes(searchTerm);
    });
  }
  
  renderBanks();
};

// Owner sadece bankaları görüntüleyebilir, ekleme/düzenleme/silme yetkisi yok

// Mesaj Gösterme
function showMessage(message, type = "success") {
  const container = document.getElementById("messageContainer");
  const messageClass = type === "error" ? "error-message" : "success-message";
  const icon = type === "error" ? "fa-triangle-exclamation" : "fa-check-circle";
  
  container.innerHTML = `
    <div class="${messageClass}">
      <i class="fa-solid ${icon}"></i> ${message}
    </div>
  `;
  
  // 5 saniye sonra kaldır
  setTimeout(() => {
    container.innerHTML = "";
  }, 5000);
}

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});

