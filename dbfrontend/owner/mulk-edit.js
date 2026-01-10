let tumIlceler = [];
let currentMulkId = null;

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);

  // 2. URL'den Mülk ID'sini al
  const urlParams = new URLSearchParams(window.location.search);
  currentMulkId = urlParams.get("id");

  if (!currentMulkId) {
    alert("Mülk ID bulunamadı!");
    window.location.href = "mulkler.html";
    return;
  }

  // 3. Sözlük Verilerini Çek
  try {
    const sozluk = await API.get("/sozluk/all");
    if (sozluk) {
      populateSelectSafe(
        "sehir",
        sozluk.Sehir || sozluk.sehir,
        "SehirID",
        "SehirAdi"
      );
      tumIlceler = sozluk.Ilce || sozluk.ilce || [];
      populateSelectSafe(
        "mulkTuru",
        sozluk.MulkTuru || sozluk.mulkTuru,
        "MulkTuruID",
        "Ad"
      );
      populateSelectSafe(
        "paraBirimi",
        sozluk.ParaBirimi || sozluk.paraBirimi,
        "ParaBirimiID",
        "Kod"
      );
    }
  } catch (err) {
    console.error("Veri hatası:", err);
  }

  // 4. Mülk Bilgilerini Yükle
  await loadPropertyData();

  // 5. Şehir Değişince İlçeleri Getir
  document.getElementById("sehir").addEventListener("change", function () {
    const secilenSehirID = this.value;
    const ilceSelect = document.getElementById("ilce");

    ilceSelect.innerHTML = '<option value="">Seçiniz...</option>';
    ilceSelect.disabled = true;

    if (secilenSehirID) {
      API.get(`/Sozluk/ilce/${secilenSehirID}`).then(ilceler => {
        if (ilceler && ilceler.length > 0) {
          populateSelectSafe("ilce", ilceler, "IlceID", "IlceAdi");
          ilceSelect.disabled = false;
        } else {
          const filtrelenmis = tumIlceler.filter(
            (x) => (x.sehirID || x.SehirID) == secilenSehirID
          );
          populateSelectSafe("ilce", filtrelenmis, "IlceID", "IlceAdi");
          ilceSelect.disabled = false;
        }
      }).catch(e => {
        const filtrelenmis = tumIlceler.filter(
          (x) => (x.sehirID || x.SehirID) == secilenSehirID
        );
        populateSelectSafe("ilce", filtrelenmis, "IlceID", "IlceAdi");
        ilceSelect.disabled = false;
      });
    }
  });

  // 6. Form Gönderme
  document.getElementById("editPropertyForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = document.querySelector(".btn-save");
    const originalText = submitBtn.innerText;
    submitBtn.innerText = "Güncelleniyor...";
    submitBtn.disabled = true;

    try {
      // A) ŞEHİR ID BUL
      const isNewCity = document.querySelector('input[name="cityType"]:checked').value === "new";
      let finalSehirID = null;

      if (isNewCity) {
        const cityName = document.getElementById("newSehirName").value.trim();
        if (!cityName) {
          alert("Şehir adı giriniz.");
          return;
        }
        const res = await API.post("/sozluk/sehir", { sehirAdi: cityName });
        if (res && res.sehirID) finalSehirID = res.sehirID;
        else throw new Error("Şehir eklenemedi.");
      } else {
        finalSehirID = document.getElementById("sehir").value;
        if (!finalSehirID) {
          alert("Şehir seçiniz.");
          return;
        }
      }

      // B) İLÇE ID BUL
      const isNewDistrict = document.querySelector('input[name="districtType"]:checked').value === "new";
      let finalIlceID = null;

      if (isNewDistrict || isNewCity) {
        const distName = document.getElementById("newIlceName").value;
        if (!distName) {
          alert("İlçe adı giriniz.");
          return;
        }
        const res = await API.post("/sozluk/ilce", {
          sehirID: finalSehirID,
          ilceAdi: distName,
        });
        if (res && res.ilceID) finalIlceID = res.ilceID;
        else throw new Error("İlçe eklenemedi.");
      } else {
        finalIlceID = document.getElementById("ilce").value;
        if (!finalIlceID) {
          alert("İlçe seçiniz.");
          return;
        }
      }

      // C) MÜLKÜ GÜNCELLE
      const data = {
        baslik: document.getElementById("baslik").value,
        mulkTuruID: document.getElementById("mulkTuru").value,
        ilceID: finalIlceID,
        adres: document.getElementById("adres").value,
        odaSayisi: document.getElementById("odaSayisi").value || null,
        metrekare: parseFloat(document.getElementById("metrekare").value),
        alimTarihi: document.getElementById("alimTarihi").value || null,
        alimBedeli: document.getElementById("alimBedeli").value ? parseFloat(document.getElementById("alimBedeli").value) : null,
        paraBirimiID: document.getElementById("paraBirimi").value || null,
        aktifMi: document.getElementById("aktifMi").value === "true",
        aciklama: document.getElementById("aciklama").value || null,
      };

      const result = await API.put(`/Mulk/${currentMulkId}`, data);
      if (result) {
        alert("Mülk başarıyla güncellendi!");
        window.location.href = "mulkler.html";
      }
    } catch (error) {
      console.error(error);
      alert("İşlem sırasında hata oluştu: " + error.message);
    } finally {
      submitBtn.innerText = originalText;
      submitBtn.disabled = false;
    }
  });
});

// Mülk Bilgilerini Yükle
async function loadPropertyData() {
  try {
    const mulk = await API.get(`/Mulk/${currentMulkId}`);
    
    if (mulk) {
      // Form alanlarını doldur
      document.getElementById("baslik").value = mulk.baslik || mulk.Baslik || "";
      document.getElementById("odaSayisi").value = mulk.odaSayisi || mulk.OdaSayisi || "";
      document.getElementById("metrekare").value = mulk.metrekare || mulk.Metrekare || "";
      document.getElementById("adres").value = mulk.adres || mulk.Adres || "";
      document.getElementById("aciklama").value = mulk.aciklama || mulk.Aciklama || "";
      
      // Tarih formatla (YYYY-MM-DD)
      if (mulk.alimTarihi || mulk.AlimTarihi) {
        const tarih = new Date(mulk.alimTarihi || mulk.AlimTarihi);
        const year = tarih.getFullYear();
        const month = String(tarih.getMonth() + 1).padStart(2, '0');
        const day = String(tarih.getDate()).padStart(2, '0');
        document.getElementById("alimTarihi").value = `${year}-${month}-${day}`;
      }
      
      document.getElementById("alimBedeli").value = mulk.alimBedeli || mulk.AlimBedeli || "";
      
      // Select'leri doldur
      if (mulk.mulkTuruID || mulk.MulkTuruID) {
        document.getElementById("mulkTuru").value = mulk.mulkTuruID || mulk.MulkTuruID;
      }
      
      if (mulk.paraBirimiID || mulk.ParaBirimiID) {
        document.getElementById("paraBirimi").value = mulk.paraBirimiID || mulk.ParaBirimiID;
      }
      
      if (mulk.aktifMi !== undefined) {
        document.getElementById("aktifMi").value = mulk.aktifMi ? "true" : "false";
      }
      
      // Şehir ve İlçe
      if (mulk.sehirID || mulk.SehirID) {
        const sehirID = mulk.sehirID || mulk.SehirID;
        document.getElementById("sehir").value = sehirID;
        
        // İlçeleri yükle
        try {
          const ilceler = await API.get(`/Sozluk/ilce/${sehirID}`);
          if (ilceler && ilceler.length > 0) {
            populateSelectSafe("ilce", ilceler, "IlceID", "IlceAdi");
            const ilceSelect = document.getElementById("ilce");
            ilceSelect.disabled = false;
            
            if (mulk.ilceID || mulk.IlceID) {
              ilceSelect.value = mulk.ilceID || mulk.IlceID;
            }
          }
        } catch (e) {
          // Fallback: Local filtreleme
          const filtrelenmis = tumIlceler.filter(
            (x) => (x.sehirID || x.SehirID) == sehirID
          );
          populateSelectSafe("ilce", filtrelenmis, "IlceID", "IlceAdi");
          const ilceSelect = document.getElementById("ilce");
          ilceSelect.disabled = false;
          
          if (mulk.ilceID || mulk.IlceID) {
            ilceSelect.value = mulk.ilceID || mulk.IlceID;
          }
        }
      }
    }
  } catch (error) {
    console.error("Mülk yükleme hatası:", error);
    alert("Mülk bilgileri yüklenirken hata oluştu.");
    window.location.href = "mulkler.html";
  }
}

// UI FONKSİYONLARI
function toggleLocationMode() {
  const isNew =
    document.querySelector('input[name="cityType"]:checked').value === "new";

  document.getElementById("sehir").style.display = isNew ? "none" : "block";
  document.getElementById("newSehirName").style.display = isNew
    ? "block"
    : "none";
  document.getElementById("newSehirName").required = isNew;
  document.getElementById("sehir").required = !isNew;

  const districtRadios = document.getElementsByName("districtType");
  if (isNew) {
    document.querySelector(
      'input[name="districtType"][value="new"]'
    ).checked = true;
    districtRadios.forEach((r) => (r.disabled = true));
    toggleDistrictMode();
  } else {
    districtRadios.forEach((r) => (r.disabled = false));
    document.querySelector(
      'input[name="districtType"][value="existing"]'
    ).checked = true;
    toggleDistrictMode();
  }
}

function toggleDistrictMode() {
  const isNew =
    document.querySelector('input[name="districtType"]:checked').value ===
    "new";
  document.getElementById("ilce").style.display = isNew ? "none" : "block";
  document.getElementById("newIlceName").style.display = isNew
    ? "block"
    : "none";
  document.getElementById("newIlceName").required = isNew;
  document.getElementById("ilce").required = !isNew;
}

// Yardımcı: Select Doldurma
function populateSelectSafe(elementId, dataList, keyProp, valueProp) {
  const select = document.getElementById(elementId);
  if (!select || !dataList) return;

  dataList.forEach((item) => {
    const foundKey = Object.keys(item).find(
      (k) => k.toLowerCase() === keyProp.toLowerCase()
    );
    const foundVal = Object.keys(item).find(
      (k) => k.toLowerCase() === valueProp.toLowerCase()
    );
    if (foundKey && foundVal) {
      const option = document.createElement("option");
      option.value = item[foundKey];
      option.text = item[foundVal];
      select.appendChild(option);
    }
  });
}

// Global scope
window.toggleLocationMode = toggleLocationMode;
window.toggleDistrictMode = toggleDistrictMode;

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});


