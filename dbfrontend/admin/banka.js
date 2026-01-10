// Global değişkenler
let globalBanks = [];
let filteredBanks = [];
let bankToDelete = null;

document.addEventListener("DOMContentLoaded", async () => {
  // Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);
  
  if (user.rol !== "Admin") {
    alert("Bu sayfaya sadece adminler erişebilir.");
    window.location.href = "../index.html";
    return;
  }

  // Header bilgilerini güncelle
  document.getElementById("headerUserName").innerText = user.adSoyad;
  document.getElementById("userImg").src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=ff6b6b&color=fff`;

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
    console.error("Banka yükleme hatası:", error);
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
      const id = bank.bankaID || bank.BankaID;
      const adi = bank.bankaAdi || bank.BankaAdi || "-";
      const aciklama = bank.aciklama || bank.Aciklama || "-";

      const row = `
                <tr>
                    <td style="font-weight: 600;">${adi}</td>
                    <td style="color: #8d97ad;">${aciklama}</td>
                    <td style="text-align: right;">
                        <button class="action-btn btn-edit" onclick="editBank(${id})" title="Düzenle">
                            <i class="fa-solid fa-pen"></i> Düzenle
                        </button>
                        <button class="action-btn btn-delete" onclick="deleteBank(${id})" title="Sil">
                            <i class="fa-solid fa-trash"></i> Sil
                        </button>
                    </td>
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

// Modal İşlemleri
window.openAddModal = function() {
  document.getElementById("modalTitle").innerText = "Yeni Banka Ekle";
  document.getElementById("bankForm").reset();
  document.getElementById("editId").value = "";
  document.getElementById("bankaAdiError").style.display = "none";
  document.getElementById("bankModal").style.display = "flex";
  document.getElementById("bankaAdi").focus();
};

window.editBank = function(id) {
  const bank = globalBanks.find(b => (b.bankaID || b.BankaID) == id);
  if (!bank) {
    showMessage("Banka bulunamadı.", "error");
    return;
  }

  document.getElementById("modalTitle").innerText = "Banka Düzenle";
  document.getElementById("editId").value = id;
  document.getElementById("bankaAdi").value = bank.bankaAdi || bank.BankaAdi || "";
  document.getElementById("aciklama").value = bank.aciklama || bank.Aciklama || "";
  document.getElementById("bankaAdiError").style.display = "none";
  document.getElementById("bankModal").style.display = "flex";
  document.getElementById("bankaAdi").focus();
};

window.closeModal = function() {
  document.getElementById("bankModal").style.display = "none";
  document.getElementById("bankForm").reset();
  document.getElementById("editId").value = "";
  document.getElementById("bankaAdiError").style.display = "none";
};

// Form Submit
document.getElementById("bankForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const editId = document.getElementById("editId").value;
  const bankaAdi = document.getElementById("bankaAdi").value.trim();
  const aciklama = document.getElementById("aciklama").value.trim();

  // Validation
  if (!bankaAdi) {
    document.getElementById("bankaAdiError").innerText = "Banka adı zorunludur.";
    document.getElementById("bankaAdiError").style.display = "block";
    return;
  }

  const submitBtn = e.target.querySelector("button[type=submit]");
  const originalText = submitBtn.innerText;
  submitBtn.innerText = "Kaydediliyor...";
  submitBtn.disabled = true;

  const data = {
    bankaAdi: bankaAdi,
    aciklama: aciklama || null
  };

  try {
    let result;
    if (editId) {
      // Güncelleme
      result = await API.put(`/Banka/${editId}`, data);
      if (result) {
        showMessage("Banka başarıyla güncellendi.", "success");
        closeModal();
        await loadBanks();
      }
    } else {
      // Yeni Ekleme
      result = await API.post("/Banka", data);
      if (result) {
        showMessage("Banka başarıyla eklendi.", "success");
        closeModal();
        await loadBanks();
      }
    }
  } catch (error) {
    console.error("Banka kaydetme hatası:", error);
    
    // Backend'den gelen hata mesajını kontrol et
    const errorMsg = error.message || "İşlem başarısız";
    
    if (errorMsg.includes("zaten") || errorMsg.includes("duplicate") || errorMsg.includes("kayıtlı")) {
      document.getElementById("bankaAdiError").innerText = "Bu banka zaten kayıtlı.";
      document.getElementById("bankaAdiError").style.display = "block";
    } else {
      showMessage("Hata: " + errorMsg, "error");
    }
  } finally {
    submitBtn.innerText = originalText;
    submitBtn.disabled = false;
  }
});

// Silme İşlemleri
window.deleteBank = function(id) {
  const bank = globalBanks.find(b => (b.bankaID || b.BankaID) == id);
  if (!bank) {
    showMessage("Banka bulunamadı.", "error");
    return;
  }

  bankToDelete = { id: id, adi: bank.bankaAdi || bank.BankaAdi };
  document.getElementById("deleteError").style.display = "none";
  document.getElementById("deleteModal").style.display = "flex";
};

window.closeDeleteModal = function() {
  document.getElementById("deleteModal").style.display = "none";
  bankToDelete = null;
};

window.confirmDelete = async function() {
  if (!bankToDelete) return;

  const deleteBtn = document.querySelector("#deleteModal button:last-child");
  const originalText = deleteBtn.innerText;
  deleteBtn.innerText = "Siliniyor...";
  deleteBtn.disabled = true;

  try {
    const result = await API.delete(`/Banka/${bankToDelete.id}`);
    
    if (result !== null) {
      showMessage("Banka başarıyla silindi.", "success");
      closeDeleteModal();
      await loadBanks();
    }
  } catch (error) {
    console.error("Banka silme hatası:", error);
    
    const errorMsg = error.message || "İşlem başarısız";
    
    // Foreign key hatası kontrolü
    if (errorMsg.includes("kullanılıyor") || errorMsg.includes("hesap") || errorMsg.includes("foreign") || errorMsg.includes("bağımlı")) {
      document.getElementById("deleteError").innerHTML = `
        <i class="fa-solid fa-triangle-exclamation"></i> 
        <strong>Bu banka silinemez!</strong><br>
        Bu banka bazı hesaplarda kullanıldığı için silinemez. Önce ilgili banka hesaplarını silin veya pasif yapın.
      `;
      document.getElementById("deleteError").style.display = "block";
    } else {
      showMessage("Hata: " + errorMsg, "error");
    }
  } finally {
    deleteBtn.innerText = originalText;
    deleteBtn.disabled = false;
  }
};

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


