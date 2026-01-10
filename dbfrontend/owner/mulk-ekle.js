let tumIlceler = [];

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Yetki Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);

  // 2. Sözlük Verilerini Çek
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

  // 3. Şehir Değişince İlçeleri Getir
  document.getElementById("sehir").addEventListener("change", function () {
    const secilenSehirID = this.value;
    const ilceSelect = document.getElementById("ilce");

    ilceSelect.innerHTML = '<option value="">Seçiniz...</option>';
    ilceSelect.disabled = true;

    if (secilenSehirID) {
      // Önce backend'den ilçeleri çekmeyi dene
      API.get(`/Sozluk/ilce/${secilenSehirID}`).then(ilceler => {
        if (ilceler && ilceler.length > 0) {
          populateSelectSafe("ilce", ilceler, "IlceID", "IlceAdi");
          ilceSelect.disabled = false;
        } else {
          // Fallback: Local filtreleme
          const filtrelenmis = tumIlceler.filter(
            (x) => (x.sehirID || x.SehirID) == secilenSehirID
          );
          populateSelectSafe("ilce", filtrelenmis, "IlceID", "IlceAdi");
          ilceSelect.disabled = false;
        }
      }).catch(e => {
        // Hata durumunda local filtreleme
        const filtrelenmis = tumIlceler.filter(
          (x) => (x.sehirID || x.SehirID) == secilenSehirID
        );
        populateSelectSafe("ilce", filtrelenmis, "IlceID", "IlceAdi");
        ilceSelect.disabled = false;
      });
    }
  });

  // İlçe Arama Özelliği
  const ilceSelect = document.getElementById("ilce");
  if (ilceSelect) {
    // İlçe select'ine arama input'u ekle
    const ilceSearchContainer = document.createElement("div");
    ilceSearchContainer.style.position = "relative";
    ilceSearchContainer.style.marginBottom = "10px";
    
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "İlçe ara...";
    searchInput.id = "ilceSearch";
    searchInput.style.width = "100%";
    searchInput.style.padding = "8px";
    searchInput.style.borderRadius = "6px";
    searchInput.style.border = "1px solid rgba(255,255,255,0.1)";
    searchInput.style.background = "rgba(0,0,0,0.2)";
    searchInput.style.color = "#fff";
    searchInput.style.display = "none";
    
    searchInput.addEventListener("input", function() {
      const searchTerm = this.value.toLowerCase();
      const sehirID = document.getElementById("sehir").value;
      
      if (sehirID && searchTerm.length >= 2) {
        // Backend'de ilçe ara
        API.get(`/Mulk/ilceAra?sehirId=${sehirID}&ad=${encodeURIComponent(searchTerm)}`).then(results => {
          if (results && results.length > 0) {
            ilceSelect.innerHTML = '<option value="">Seçiniz...</option>';
            results.forEach(ilce => {
              const opt = document.createElement("option");
              opt.value = ilce.ilceID || ilce.IlceID;
              opt.text = ilce.ilceAdi || ilce.IlceAdi;
              ilceSelect.appendChild(opt);
            });
            ilceSelect.disabled = false;
          }
        }).catch(e => {
          console.log("İlçe arama hatası:", e);
        });
      }
    });
    
    ilceSelect.parentNode.insertBefore(ilceSearchContainer, ilceSelect);
    ilceSearchContainer.appendChild(searchInput);
    
    // Şehir seçilince arama input'unu göster
    document.getElementById("sehir").addEventListener("change", function() {
      if (this.value) {
        searchInput.style.display = "block";
      } else {
        searchInput.style.display = "none";
      }
    });
  }

  // 4. KAYDET BUTONU (YENİ ŞEHİR/İLÇE MANTIĞI)
  document
    .getElementById("addPropertyForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const isNewCity =
        document.querySelector('input[name="cityType"]:checked').value ===
        "new";
      const isNewDistrict =
        document.querySelector('input[name="districtType"]:checked').value ===
        "new";

      let finalSehirID = null;
      let finalIlceID = null;

      try {
        // A) ŞEHİR ID BUL
        if (isNewCity) {
          const cityName = document.getElementById("newSehirName").value;
          if (!cityName) {
            alert("Şehir adı giriniz.");
            return;
          }

          // Backend'e ekle
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
        if (isNewDistrict || isNewCity) {
          // Yeni şehir varsa ilçe mecburen yeni olur
          const distName = document.getElementById("newIlceName").value;
          if (!distName) {
            alert("İlçe adı giriniz.");
            return;
          }

          // Backend'e ekle
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

        // C) MÜLKÜ KAYDET
        const data = {
          sahipKullaniciID: user.kullaniciID || user.KullaniciID,
          baslik: document.getElementById("baslik").value,
          mulkTuruID: document.getElementById("mulkTuru").value,
          ilceID: finalIlceID, // Bulunan ID
          adres: document.getElementById("adres").value,
          odaSayisi: document.getElementById("odaSayisi").value,
          metrekare: document.getElementById("metrekare").value,
          alimTarihi: document.getElementById("alimTarihi").value || null,
          alimBedeli: document.getElementById("alimBedeli").value || null,
          paraBirimiID: document.getElementById("paraBirimi").value || null,
          aktifMi: true,
        };

        const result = await API.post("/mulk", data);
        if (result) {
          // Bildirim oluştur
          try {
            const propertyName = document.getElementById("baslik").value.trim();
            await Notifications.propertyAdded(user.kullaniciID || user.KullaniciID, propertyName);
          } catch (notifError) {
            console.error("Bildirim oluşturma hatası:", notifError);
          }
          
          alert("Mülk başarıyla kaydedildi!");
          window.location.href = "mulkler.html";
        }
      } catch (error) {
        console.error(error);
        alert("İşlem sırasında hata oluştu: " + error.message);
      }
    });
});

// UI FONKSİYONLARI (Görünürlük Ayarları)
function toggleLocationMode() {
  const isNew =
    document.querySelector('input[name="cityType"]:checked').value === "new";

  document.getElementById("sehir").style.display = isNew ? "none" : "block";
  document.getElementById("newSehirName").style.display = isNew
    ? "block"
    : "none";
  document.getElementById("newSehirName").required = isNew;
  document.getElementById("sehir").required = !isNew;

  // Yeni şehir seçilirse ilçe de mecburen "Yeni" moduna geçer
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

// Yardımcı: Select Doldurma (Harf duyarlılığını yoksayar)
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

// Global scope (HTML onclick için)
window.toggleLocationMode = toggleLocationMode;
window.toggleDistrictMode = toggleDistrictMode;

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});
