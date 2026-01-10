// Global değişken: Verileri burada tutacağız (Edit işlemi için)
let globalRequests = [];

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Yetki ve Kullanıcı Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);
  if (user.rol !== "Owner") {
    window.location.href = "../index.html";
    return;
  }

  // Profil Bilgilerini Header'a Yaz
  const headerName = document.getElementById("headerUserName");
  if (headerName) headerName.innerText = user.adSoyad;

  const userImg = document.getElementById("userImg");
  if (userImg)
    userImg.src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=00d4ff&color=fff`;

  // Verileri Yükle
  await loadRequests(user.kullaniciID);
  await loadProperties(user.kullaniciID);

  // Form Event Listener'ı ekle
  const talepForm = document.getElementById("talepForm");
  if (talepForm) {
    talepForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const id = document.getElementById("editId").value;
      const currentUser = JSON.parse(localStorage.getItem("user"));

      // A) GÜNCELLEME (PUT)
      if (id) {
        // Durum alanını kontrol et
        const durum = document.getElementById("durum").value;
        if (!durum || durum.trim() === "") {
          alert("Lütfen durum seçiniz.");
          return;
        }
        
        // Tutar alanını kontrol et - boşsa null, doluysa decimal'e çevir
        const tutarValue = document.getElementById("tutar").value.trim();
        let gercekTutar = null;
        if (tutarValue !== "" && tutarValue !== null) {
          const parsed = parseFloat(tutarValue);
          if (!isNaN(parsed)) {
            gercekTutar = parsed;
          }
        }
        
        const updateData = {
          durum: durum,
          gercekTutar: gercekTutar,
        };

        const res = await API.put(`/BakimTalep/${id}/durum`, updateData);
        if (res) {
          // Bildirim oluştur
          try {
            const request = globalRequests.find(r => (r.bakimTalepID || r.BakimTalepID) == id);
            if (request) {
              const propertyName = request.mulkBaslik || request.MulkBaslik || "Mülk";
              const mulkID = request.mulkID || request.MulkID;
              const newStatus = updateData.durum;
              
              // Ev sahibine bildirim
              await Notifications.maintenanceRequestUpdated(currentUser.kullaniciID, propertyName, newStatus);
              
              // Kiracıya bildirim (eğer mülk ID'si varsa, sözleşmeden kiracıyı bul)
              if (mulkID) {
                try {
                  const contracts = await API.get(`/KiraSozlesme?userId=${currentUser.kullaniciID}&role=Owner`);
                  if (contracts && contracts.length > 0) {
                    const contract = contracts.find(c => (c.mulkID || c.MulkID) == mulkID && c.aktifMi);
                    if (contract) {
                      const kiraciID = contract.kiraciID || contract.KiraciID;
                      // KiraciID'den KullaniciID'ye çevir
                      if (kiraciID) {
                        try {
                          const tumKiracilar = await API.get("/Kiraci/aktif");
                          const kiraci = tumKiracilar?.find(
                            (k) => (k.kiraciID || k.KiraciID) == kiraciID
                          );
                          const tenantKullaniciID = kiraci?.kullaniciID || kiraci?.KullaniciID;
                          if (tenantKullaniciID) {
                            await Notifications.maintenanceRequestUpdatedForTenant(tenantKullaniciID, propertyName, newStatus);
                          }
                        } catch (kiraciError) {
                          console.error("Kiracı bilgisi alınamadı:", kiraciError);
                        }
                      }
                    }
                  }
                } catch (tenantNotifError) {
                  console.error("Kiracıya bildirim gönderme hatası:", tenantNotifError);
                }
              }
            }
          } catch (notifError) {
            console.error("Bildirim oluşturma hatası:", notifError);
          }
          
          alert("Güncellendi.");
          window.closeModal();
          loadRequests(currentUser.kullaniciID);
        }
      }
      // B) YENİ EKLEME (POST)
      else {
        const newData = {
          mulkID: document.getElementById("mulkSelect").value,
          aciklama: document.getElementById("aciklama").value,
          durum: document.getElementById("durum").value,
          tahminiTutar: document.getElementById("tutar").value,
        };

        const res = await API.post("/BakimTalep", newData);
        if (res) {
          // Bildirim oluştur
          try {
            const mulkSelect = document.getElementById("mulkSelect");
            const propertyName = mulkSelect.options[mulkSelect.selectedIndex]?.text || "Mülk";
            const aciklama = newData.aciklama;
            await Notifications.maintenanceRequestCreated(currentUser.kullaniciID, propertyName, aciklama);
          } catch (notifError) {
            console.error("Bildirim oluşturma hatası:", notifError);
          }
          
          alert("Oluşturuldu.");
          window.closeModal();
          loadRequests(currentUser.kullaniciID);
        }
      }
    });
  }
});

// --- TALEPLERİ LİSTELE ---
async function loadRequests(userId) {
  const container = document.getElementById("requestList");
  container.innerHTML =
    "<p style='color:#888; text-align:center;'>Yükleniyor...</p>";

  try {
    const requests = await API.get(`/BakimTalep/owner/${userId}`);

    // Gelen veriyi hafızaya alıyoruz
    globalRequests = requests || [];

    container.innerHTML = "";

    if (globalRequests.length > 0) {
      globalRequests.forEach((r) => {
        // Güvenli Veri Okuma
        const id = r.bakimTalepID || r.BakimTalepID;
        const mulk = r.mulkBaslik || r.MulkBaslik || "Mülk Bilinmiyor";
        const aciklama = r.aciklama || r.Aciklama || "";
        const durum = r.durum || r.Durum || "Acik";
        const tarihRaw = r.talepTarihi || r.TalepTarihi;
        const tutar = r.tahminiTutar || r.TahminiTutar;

        // Görsel Ayarlar
        let badgeClass = "status-open";
        let badgeText = "Açık";
        if (durum === "Devam Ediyor") {
          badgeClass = "status-progress";
          badgeText = "İşlemde";
        }
        if (durum === "Tamamlandi") {
          badgeClass = "status-done";
          badgeText = "Tamamlandı";
        }

        const tarih = tarihRaw
          ? new Date(tarihRaw).toLocaleDateString("tr-TR")
          : "-";

        const tutarHtml = tutar
          ? `<span style="color:#00d4ff; font-weight:500; margin-left:10px;"><i class="fa-solid fa-coins"></i> ${tutar} ₺</span>`
          : "";

        const opacity = durum === "Tamamlandi" ? "0.6" : "1";

        // ÖNEMLİ: onclick içine sadece ID gönderiyoruz.
        const html = `
                    <div class="request-card" style="opacity:${opacity}">
                        <div class="req-info">
                            <h4><i class="fa-solid fa-house-chimney" style="color:#8d97ad; font-size:0.9rem; margin-right:5px;"></i> ${mulk}</h4>
                            <p>${aciklama}</p>
                            <div class="req-date">
                                <span><i class="fa-regular fa-clock"></i> ${tarih}</span>
                                ${tutarHtml}
                            </div>
                        </div>
                        <div class="req-actions">
                            <span class="badge-status ${badgeClass}">${badgeText}</span>
                            <button class="btn-edit" title="Düzenle" onclick="editRequest(${id})">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-delete" title="Sil" onclick="deleteRequest(${id})" style="width: 35px; height: 35px; border-radius: 50%; border: none; cursor: pointer; background: rgba(255, 75, 92, 0.1); color: #ff4b5c; display: inline-flex; align-items: center; justify-content: center; transition: 0.3s; margin-left: 5px;">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
        container.innerHTML += html;
      });
    } else {
      container.innerHTML = `
                <div style="text-align:center; padding:3rem; color:#888;">
                    <i class="fa-solid fa-clipboard-check" style="font-size:3rem; margin-bottom:1rem; opacity:0.3;"></i>
                    <p>Bekleyen talep bulunmuyor.</p>
                </div>`;
    }
  } catch (err) {
    console.error(err);
    container.innerHTML =
      "<p style='color:red; text-align:center;'>Veriler yüklenirken hata oluştu.</p>";
  }
}

// --- MODAL İŞLEMLERİ (Global Scope) ---

// Yeni Ekleme Modu
window.openModal = function () {
  document.getElementById("talepForm").reset();
  document.getElementById("editId").value = "";
  document.getElementById("modalTitle").innerText = "Yeni Talep Oluştur";

  // Yeni eklerken her alan serbest
  toggleFields(true);

  document.getElementById("talepModal").style.display = "flex";
};

// Düzenleme Modu (ID ile veriyi bulup doldurur)
window.editRequest = function (id) {
  // Hafızadaki listeden ilgili kaydı buluyoruz
  const record = globalRequests.find(
    (r) => (r.bakimTalepID || r.BakimTalepID) == id
  );

  if (!record) {
    alert("Kayıt bulunamadı!");
    return;
  }

  document.getElementById("editId").value = id;
  document.getElementById("modalTitle").innerText = "Talebi Güncelle";

  // Verileri Güvenli Şekilde Doldur
  const mulkID = record.mulkID || record.MulkID;
  const aciklama = record.aciklama || record.Aciklama;
  const durum = record.durum || record.Durum;
  const tutar = record.tahminiTutar || record.TahminiTutar;

  document.getElementById("mulkSelect").value = mulkID;
  document.getElementById("aciklama").value = aciklama;
  document.getElementById("durum").value = durum;
  document.getElementById("tutar").value = tutar || "";

  // Düzenleme modunda Mülk ve Açıklamayı kilitliyoruz (Sadece durum değişsin)
  toggleFields(false);

  document.getElementById("talepModal").style.display = "flex";
};

// Modal Kapat
window.closeModal = function () {
  document.getElementById("talepModal").style.display = "none";
};

// Form Alanlarını Kilitle/Aç Yardımcısı
function toggleFields(isNew) {
  const mulkSelect = document.getElementById("mulkSelect");
  const txtAciklama = document.getElementById("aciklama");

  if (isNew) {
    mulkSelect.disabled = false;
    txtAciklama.disabled = false;
  } else {
    mulkSelect.disabled = true;
    txtAciklama.disabled = true;
  }
}

// --- MÜLKLERİ DOLDUR ---
async function loadProperties(userId) {
  try {
    const mulkler = await API.get(`/Mulk?sahipId=${userId}`);
    const sel = document.getElementById("mulkSelect");

    // İlk seçenek hariç temizle
    sel.innerHTML = '<option value="">Seçiniz...</option>';

    if (mulkler) {
      mulkler.forEach((m) => {
        const aktifMi = m.aktifMi !== undefined ? m.aktifMi : m.AktifMi;
        if (aktifMi) {
          const opt = document.createElement("option");
          opt.value = m.mulkID || m.MulkID;
          opt.text = m.baslik || m.Baslik;
          sel.appendChild(opt);
        }
      });
    }
  } catch (e) {
    console.error(e);
  }
}

// Talep Silme
window.deleteRequest = async function (id) {
  if (!confirm("Bu talebi silmek istediğinize emin misiniz?")) {
    return;
  }

  try {
    const user = JSON.parse(localStorage.getItem("user"));
    const res = await API.delete(`/BakimTalep/${id}`);
    if (res !== null) {
      alert("Talep silindi.");
      loadRequests(user.kullaniciID);
    }
  } catch (error) {
    console.error("Silme hatası:", error);
    alert("Hata: " + error.message);
  }
};

// Çıkış Butonu
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});
