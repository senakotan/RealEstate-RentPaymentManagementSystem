let currentContractId = null;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);

  // 2. URL'den Sözleşme ID'sini al
  const urlParams = new URLSearchParams(window.location.search);
  currentContractId = urlParams.get("id");

  if (!currentContractId) {
    alert("Sözleşme ID bulunamadı!");
    window.location.href = "sozlesmeler.html";
    return;
  }

  // 3. Para Birimlerini Yükle
  try {
    const sozluk = await API.get("/sozluk/all");
    if (sozluk && sozluk.ParaBirimi) {
      const pbList = sozluk.ParaBirimi || sozluk.paraBirimi || [];
      const pbSelect = document.getElementById("paraBirimi");
      if (pbSelect) {
        pbSelect.innerHTML = "";
        pbList.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = p.ParaBirimiID || p.paraBirimiID;
          opt.text = p.Kod || p.kod;
          pbSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.error("Para birimi yükleme hatası:", err);
  }

  // 4. Sözleşme Bilgilerini Yükle
  await loadContractData();

  // 5. Form Gönderme
  document.getElementById("editContractForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = document.querySelector(".btn-save");
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Güncelleniyor...";
    submitBtn.disabled = true;

    try {
      // Tarih formatını kontrol et ve düzelt
      const baslangicTarihi = document.getElementById("baslangic").value;
      const bitisTarihi = document.getElementById("bitis").value || null;
      
      if (!baslangicTarihi) {
        alert("Başlangıç tarihi zorunludur.");
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
        return;
      }

      const data = {
        mulkID: parseInt(document.getElementById("mulkSelect").value),
        kiraciID: parseInt(document.getElementById("kiraciInfo").dataset.kiraciId),
        aylikKiraTutar: parseFloat(document.getElementById("tutar").value),
        paraBirimiID: parseInt(document.getElementById("paraBirimi").value),
        odemeGunu: parseInt(document.getElementById("odemeGunu").value),
        baslangicTarihi: baslangicTarihi,
        bitisTarihi: bitisTarihi,
        depozitoTutar: document.getElementById("depozito").value ? parseFloat(document.getElementById("depozito").value) : null,
        aktifMi: document.getElementById("aktifMi").value === "true",
        aciklama: document.getElementById("aciklama").value || null,
      };

      // Validasyon kontrolleri
      if (isNaN(data.mulkID) || data.mulkID <= 0) {
        alert("Geçerli bir mülk seçilmelidir.");
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
        return;
      }

      if (isNaN(data.kiraciID) || data.kiraciID <= 0) {
        alert("Geçerli bir kiracı seçilmelidir.");
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
        return;
      }

      if (isNaN(data.aylikKiraTutar) || data.aylikKiraTutar <= 0) {
        alert("Kira tutarı 0'dan büyük olmalıdır.");
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
        return;
      }

      // Ödeme günü kontrolü
      if (data.odemeGunu < 1 || data.odemeGunu > 31) {
        alert("Ödeme günü 1-31 arasında olmalıdır.");
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
        return;
      }

      const result = await API.put(`/KiraSozlesme/${currentContractId}`, data);
      if (result !== null && result !== undefined) {
        alert("Sözleşme başarıyla güncellendi!");
        window.location.href = "sozlesmeler.html";
      } else {
        throw new Error("Güncelleme başarısız oldu.");
      }
    } catch (error) {
      console.error("Sözleşme güncelleme hatası:", error);
      const errorMessage = error.message || error.response?.message || "Bilinmeyen bir hata oluştu. Lütfen tekrar deneyin.";
      alert("Hata: " + errorMessage);
    } finally {
      submitBtn.innerText = originalText;
      submitBtn.disabled = false;
    }
  });
});

// Sözleşme Bilgilerini Yükle
async function loadContractData() {
  try {
    const contract = await API.get(`/KiraSozlesme/${currentContractId}`);

    if (!contract) {
      // Fallback: Owner'ın sözleşmelerini çek
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        const ownerId = user.kullaniciID || user.KullaniciID;
        
        if (ownerId) {
          const contracts = await API.get(`/KiraSozlesme?userId=${ownerId}&role=Owner`);
          
          if (Array.isArray(contracts) && contracts.length > 0) {
            const foundContract = contracts.find(c => {
              const cId = c.kiraSozlesmeID || c.KiraSozlesmeID;
              return cId == currentContractId || cId === parseInt(currentContractId);
            });
            
            if (foundContract) {
              populateForm(foundContract);
              return;
            }
          }
        }
      }
      
      alert("Sözleşme bulunamadı.");
      window.location.href = "sozlesmeler.html";
      return;
    }

    populateForm(contract);
  } catch (error) {
    console.error("Sözleşme yükleme hatası:", error);
    alert("Sözleşme bilgileri yüklenirken hata oluştu.");
    window.location.href = "sozlesmeler.html";
  }
}

// Formu Doldur
function populateForm(contract) {
  // Mülk bilgisi (disabled)
  const mulkBaslik = contract.mulkBaslik || contract.MulkBaslik || "-";
  const mulkSelect = document.getElementById("mulkSelect");
  mulkSelect.innerHTML = `<option value="${contract.mulkID || contract.MulkID}" selected>${mulkBaslik}</option>`;

  // Kiracı bilgisi (disabled)
  const kiraciAd = contract.kiraciAdSoyad || contract.KiraciAdSoyad || "-";
  const kiraciEmail = contract.kiraciEmail || contract.KiraciEmail || "";
  const kiraciInfo = document.getElementById("kiraciInfo");
  kiraciInfo.value = `${kiraciAd} (${kiraciEmail})`;
  kiraciInfo.dataset.kiraciId = contract.kiraciID || contract.KiraciID;

  // Form alanlarını doldur
  document.getElementById("tutar").value = contract.aylikKiraTutar || contract.AylikKiraTutar || "";
  document.getElementById("odemeGunu").value = contract.odemeGunu || contract.OdemeGunu || 1;
  document.getElementById("aciklama").value = contract.aciklama || contract.Aciklama || "";

  // Para birimi
  if (contract.paraBirimiID || contract.ParaBirimiID) {
    document.getElementById("paraBirimi").value = contract.paraBirimiID || contract.ParaBirimiID;
  }

  // Depozito
  if (contract.depozitoTutar || contract.DepozitoTutar) {
    document.getElementById("depozito").value = contract.depozitoTutar || contract.DepozitoTutar;
  }

  // Durum
  const aktifMi = contract.aktifMi !== undefined ? contract.aktifMi : contract.AktifMi;
  document.getElementById("aktifMi").value = aktifMi ? "true" : "false";

  // Tarihleri formatla (YYYY-MM-DD)
  if (contract.baslangicTarihi || contract.BaslangicTarihi) {
    const baslangic = new Date(contract.baslangicTarihi || contract.BaslangicTarihi);
    const year = baslangic.getFullYear();
    const month = String(baslangic.getMonth() + 1).padStart(2, '0');
    const day = String(baslangic.getDate()).padStart(2, '0');
    document.getElementById("baslangic").value = `${year}-${month}-${day}`;
  }

  if (contract.bitisTarihi || contract.BitisTarihi) {
    const bitis = new Date(contract.bitisTarihi || contract.BitisTarihi);
    const year = bitis.getFullYear();
    const month = String(bitis.getMonth() + 1).padStart(2, '0');
    const day = String(bitis.getDate()).padStart(2, '0');
    document.getElementById("bitis").value = `${year}-${month}-${day}`;
  }
}

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});

