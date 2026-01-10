// Global Liste: Düzenleme işlemi için verileri hafızada tutar
let globalTenants = [];
let filteredTenants = [];

// Random Şifre Oluşturma Fonksiyonu
function generateRandomPassword(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Yetki Kontrolü
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

  loadTenants(user.kullaniciID);
  
  // Email input'una yazıldığında hata mesajını temizle
  const emailInput = document.getElementById("tEmail");
  if (emailInput) {
    emailInput.addEventListener("input", () => {
      document.getElementById("emailError").style.display = "none";
    });
  }
});

// Tek bir kiracı satırını render et
function renderTenantRow(t) {
  const tableBody = document.getElementById("tenantList");
  if (!tableBody) return;
  
  // Güvenli veri okuma
  const id = t.kiraciID || t.KiraciID;
  const ad = (t.adSoyad || t.AdSoyad || "").trim();
  const email = t.email || t.Email || "-";
  const tel = t.telefon || t.Telefon || "-";
  const tc = t.tcNo || t.TCNo || "-";
  const aktifMi = t.aktifMi !== undefined ? t.aktifMi : t.AktifMi;

  // İsim baş harfleri (Avatar için) - güvenli kontrol
  const initials = ad && ad.length > 0
    ? ad
        .split(" ")
        .filter(n => n && n.length > 0)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2)
    : "??";

  // Durum Rozeti
  const statusBadge = aktifMi
    ? `<span style="background:rgba(0,200,83,0.2); color:#00c853; padding:4px 10px; border-radius:15px; font-size:0.75rem;">Aktif</span>`
    : `<span style="background:rgba(255,75,92,0.2); color:#ff4b5c; padding:4px 10px; border-radius:15px; font-size:0.75rem;">Pasif</span>`;

  const row = `
    <tr>
      <td>
        <div class="tenant-profile">
          <div class="avatar-initial">${initials}</div>
          <span style="font-weight:500;">${ad}</span>
        </div>
      </td>
      <td>
        <div style="font-size:0.9rem;">${email}</div>
        <div style="font-size:0.8rem; color:#8d97ad; margin-top:3px;">${tel}</div>
      </td>
      <td>${tc}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="action-btn btn-edit" title="Düzenle" onclick="editTenant(${id})">
          <i class="fa-solid fa-pen"></i>
        </button>
      </td>
    </tr>
  `;
  tableBody.innerHTML += row;
}

// Kiracıları Listele
async function loadTenants(ownerId) {
  const tableBody = document.getElementById("tenantList");
  tableBody.innerHTML =
    "<tr><td colspan='5' style='text-align:center; color:#888;'>Yükleniyor...</td></tr>";

  try {
    // Backend: Sadece bu mülk sahibine ait kiracıları getir
    let tenants = await API.get(`/Kiraci/owner/${ownerId}`);
    
    // Eğer boş dönerse veya hata olursa, tüm kiracıları çekip filtrele
    if (!tenants || tenants.length === 0) {
      try {
        const allTenants = await API.get("/Kiraci/aktif");
        if (allTenants && Array.isArray(allTenants)) {
          // Owner'ın sözleşmelerini çek ve kiracıları bul
          const contracts = await API.get(`/KiraSozlesme?userId=${ownerId}&role=Owner`);
          if (contracts && Array.isArray(contracts)) {
            const ownerKiraciIDs = new Set();
            contracts.forEach(c => {
              const kiraciID = c.kiraciID || c.KiraciID;
              if (kiraciID) ownerKiraciIDs.add(kiraciID);
            });
            
            // Owner'ın sözleşmelerindeki kiracıları filtrele
            tenants = allTenants.filter(t => {
              const tID = t.kiraciID || t.KiraciID;
              return ownerKiraciIDs.has(tID);
            });
          }
        }
      } catch (fallbackError) {
        // Fallback başarısız, boş liste kullan
        tenants = [];
      }
    }

    // Veriyi globale al
    globalTenants = tenants || [];
    filteredTenants = [...globalTenants]; // Arama için kopya

    tableBody.innerHTML = "";

    if (filteredTenants.length > 0) {
      filteredTenants.forEach((t) => {
        renderTenantRow(t);
      });
    } else {
      tableBody.innerHTML =
        "<tr><td colspan='5' style='text-align:center; padding:2rem; color:#888;'>Henüz kayıtlı kiracınız yok.</td></tr>";
    }
  } catch (error) {
    tableBody.innerHTML =
      "<tr><td colspan='5' style='color:red; text-align:center;'>Veri yüklenirken hata oluştu.</td></tr>";
  }
}

// --- MODAL İŞLEMLERİ ---
// Yeni kiracı ekleme kaldırıldı - artık sadece sözleşme ekleme sayfasından email ile ekleniyor

// Düzenleme Modu
window.editTenant = function (id) {
  const tenant = globalTenants.find((t) => (t.kiraciID || t.KiraciID) == id);
  if (!tenant) {
    showTenantMessage("Kiracı bulunamadı.", "error");
    return;
  }

  document.getElementById("editId").value = id;
  document.getElementById("modalTitle").innerText = "Kiracı Düzenle";

  // Formu Doldur
  document.getElementById("tAd").value = tenant.adSoyad || tenant.AdSoyad;
  document.getElementById("tEmail").value = tenant.email || tenant.Email;
  document.getElementById("tTel").value = tenant.telefon || tenant.Telefon || "";
  document.getElementById("tTc").value = tenant.tcNo || tenant.TCNo || "";
  document.getElementById("tAdres").value = tenant.adres || tenant.Adres || "";
  document.getElementById("tSifre").value = "";
  
  // Email'i düzenlenebilir yap (owner kiracı bilgilerini güncelleyebilir)
  document.getElementById("tEmail").disabled = false;
  
  // Şifre bölümünü göster
  document.getElementById("passwordSection").style.display = "block";
  
  // Hata mesajlarını temizle
  document.getElementById("formError").style.display = "none";
  document.getElementById("emailError").style.display = "none";

  document.getElementById("tenantModal").style.display = "flex";
};

window.closeModal = function () {
  document.getElementById("tenantModal").style.display = "none";
  document.getElementById("tenantForm").reset();
  document.getElementById("editId").value = "";
  document.getElementById("passwordSection").style.display = "none";
  document.getElementById("tEmail").disabled = false;
  document.getElementById("formError").style.display = "none";
  document.getElementById("emailError").style.display = "none";
};

// Arama Fonksiyonu
window.filterTenants = function() {
  const searchTerm = document.getElementById("searchInput").value.toLowerCase().trim();
  const tableBody = document.getElementById("tenantList");
  
  if (!searchTerm) {
    filteredTenants = [...globalTenants];
  } else {
    filteredTenants = globalTenants.filter(t => {
      const adSoyad = (t.adSoyad || t.AdSoyad || "").toLowerCase();
      return adSoyad.includes(searchTerm);
    });
  }
  
  // Tabloyu yeniden oluştur
  tableBody.innerHTML = "";
  
  if (filteredTenants.length > 0) {
    filteredTenants.forEach((t) => {
      const id = t.kiraciID || t.KiraciID;
      const ad = t.adSoyad || t.AdSoyad;
      const email = t.email || t.Email || "-";
      const tel = t.telefon || t.Telefon || "-";
      const tc = t.tcNo || t.TCNo || "-";
      const aktifMi = t.aktifMi !== undefined ? t.aktifMi : t.AktifMi;

      const initials = ad
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .substring(0, 2);

      const statusBadge = aktifMi
        ? `<span style="background:rgba(0,200,83,0.2); color:#00c853; padding:4px 10px; border-radius:15px; font-size:0.75rem;">Aktif</span>`
        : `<span style="background:rgba(255,75,92,0.2); color:#ff4b5c; padding:4px 10px; border-radius:15px; font-size:0.75rem;">Pasif</span>`;

      const row = `
        <tr>
          <td>
            <div class="tenant-profile">
              <div class="avatar-initial">${initials}</div>
              <span style="font-weight:500;">${ad}</span>
            </div>
          </td>
          <td>
            <div style="font-size:0.9rem;">${email}</div>
            <div style="font-size:0.8rem; color:#8d97ad; margin-top:3px;">${tel}</div>
          </td>
          <td>${tc}</td>
          <td>${statusBadge}</td>
          <td>
            <button class="action-btn btn-edit" title="Düzenle" onclick="editTenant(${id})">
              <i class="fa-solid fa-pen"></i>
            </button>
          </td>
        </tr>
      `;
      tableBody.innerHTML += row;
    });
  } else {
    tableBody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:2rem; color:#888;'>Sonuç bulunamadı.</td></tr>";
  }
};

// Form Kaydetme (Sadece Güncelleme) - Yeni kiracı ekleme kaldırıldı
// Artık kiracılar sadece sözleşme ekleme sayfasından email ile ekleniyor
document.getElementById("tenantForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  
  // Hata mesajlarını temizle
  document.getElementById("formError").style.display = "none";
  document.getElementById("emailError").style.display = "none";
  
  const id = document.getElementById("editId").value;
  const user = JSON.parse(localStorage.getItem("user"));
  
  const adSoyad = document.getElementById("tAd").value.trim();
  const email = document.getElementById("tEmail").value.trim().toLowerCase(); // Email'i lowercase'e çevir (backend case-sensitive kontrol yapıyor olabilir)
  const telefon = document.getElementById("tTel").value.trim();
  const tcNo = document.getElementById("tTc").value.trim();
  const adres = document.getElementById("tAdres").value.trim();
  const sifre = document.getElementById("tSifre")?.value || "";

  // Validasyon
  if (!adSoyad) {
    document.getElementById("formError").innerText = "Ad Soyad zorunludur.";
    document.getElementById("formError").style.display = "block";
    return;
  }

  if (!email) {
    document.getElementById("emailError").innerText = "E-posta zorunludur.";
    document.getElementById("emailError").style.display = "block";
    return;
  }

  // Email format kontrolü
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    document.getElementById("emailError").innerText = "Geçerli bir e-posta adresi giriniz.";
    document.getElementById("emailError").style.display = "block";
    return;
  }

  // Şifre kontrolü (edit modunda ve şifre girilmişse)
  if (id && sifre && sifre.length > 0 && sifre.length < 6) {
    document.getElementById("formError").innerText = "Şifre en az 6 karakter olmalıdır.";
    document.getElementById("formError").style.display = "block";
    return;
  }

  // Hata mesajlarını temizle
  document.getElementById("emailError").style.display = "none";
  document.getElementById("formError").style.display = "none";
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerText;
  submitBtn.innerText = "Kaydediliyor...";
  submitBtn.disabled = true;

  // Kiraci verisi - OpenAPI spec'e göre format
  // Email her zaman var (çünkü kullanıcı kaydı yapılırken email zaten var)
  // Email'i lowercase ve trim et (backend case-sensitive kontrol yapıyor olabilir)
  const data = {
    adSoyad: adSoyad.trim(),
    email: email.trim().toLowerCase(), // Email'i lowercase'e çevir (backend case-sensitive kontrol yapıyor olabilir)
    telefon: telefon && telefon.trim() ? telefon.trim() : null,
    tcNo: tcNo && tcNo.trim() ? tcNo.trim() : null,
    aktifMi: true,
  };
  
  // Adres alanını sadece doluysa ekle
  if (adres && adres.trim()) {
    data.adres = adres.trim();
  }

  try {
    if (id) {
      // GÜNCELLEME (PUT)
      // Önce KullaniciID'yi bul (Kiraci güncellemeden önce)
      const kiraci = globalTenants.find(t => (t.kiraciID || t.KiraciID) == id);
      let kullaniciID = null;
      
      if (kiraci) {
        kullaniciID = kiraci.kullaniciID || kiraci.KullaniciID;
        
        // Eğer KullaniciID yoksa, backend'den kiracıyı çek
        if (!kullaniciID) {
          try {
            const kiraciDetail = await API.get(`/Kiraci/${id}`);
            if (kiraciDetail) {
              kullaniciID = kiraciDetail.kullaniciID || kiraciDetail.KullaniciID;
            }
          } catch (detailError) {
            console.error("Kiracı detayı alınamadı:", detailError);
            // Fallback: Tüm kiracılar listesinden bul
            try {
              const allTenants = await API.get("/Kiraci");
              if (allTenants && Array.isArray(allTenants)) {
                const kiraciDetail = allTenants.find(t => {
                  const tID = t.kiraciID || t.KiraciID;
                  return tID != null && (tID == id || tID.toString() === id.toString() || parseInt(tID) === parseInt(id));
                });
                if (kiraciDetail) {
                  kullaniciID = kiraciDetail.kullaniciID || kiraciDetail.KullaniciID;
                }
              }
            } catch (fallbackError) {
              console.error("Fallback de başarısız:", fallbackError);
            }
          }
        }
        
        // Eğer hala KullaniciID yoksa, email ile bul
        if (!kullaniciID && data.email) {
          try {
            const allUsers = await API.get("/Kullanici");
            if (allUsers && Array.isArray(allUsers)) {
              const user = allUsers.find(u => {
                const uEmail = (u.email || u.Email || "").trim().toLowerCase();
                return uEmail === data.email.trim().toLowerCase();
              });
              if (user) {
                kullaniciID = user.kullaniciID || user.KullaniciID;
              }
            }
          } catch (userError) {
            console.error("Kullanıcı bulunamadı:", userError);
          }
        }
      }
      
      // ÖNEMLİ: KullaniciID bulunamazsa güncelleme yapma (senkronizasyon için gerekli)
      if (!kullaniciID) {
        showTenantMessage("Kullanıcı hesabı bulunamadı. Güncelleme yapılamadı. Lütfen admin ile iletişime geçin.", "error");
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
        return;
      }

      // Kullanici tablosunda email, ad soyad, telefon, TC No ve şifreyi güncelle
      // AYNI BİLGİLERLE güncelle (Kiraci ile senkronize)
      const kullaniciData = {
        adSoyad: data.adSoyad.trim(), // Kiraci ile AYNI İSİM (trim edilmiş)
        email: data.email, // Kiraci ile AYNI EMAIL
        telefon: data.telefon || null,
        tcNo: data.tcNo || null,
        aktifMi: true
      };
      
      // Şifre güncellemesi (eğer şifre girilmişse)
      if (sifre && sifre.trim().length > 0) {
        kullaniciData.sifreHash = sifre; // Backend hash'leyecek
      }

      console.log("🔄 Her iki tablo da güncelleniyor (senkronize)...", {
        kullaniciID: kullaniciID,
        kiraciID: id,
        adSoyad: data.adSoyad.trim(),
        email: data.email
      });

      // Paralel olarak her iki tabloyu da güncelle
      try {
        // Kiraci tablosu sadece AktifMi durumunu içeriyor
        const kiraciUpdateData = {
          aktifMi: data.aktifMi !== undefined ? data.aktifMi : true
        };
        
        const [kullaniciRes, kiraciRes] = await Promise.all([
          API.put(`/Kullanici/${kullaniciID}`, kullaniciData),
          API.put(`/Kiraci/${id}`, kiraciUpdateData)
        ]);

        console.log("📥 API yanıtları:", { kullaniciRes, kiraciRes });

        // Her iki güncelleme de başarılı mı kontrol et
        if (kullaniciRes !== null && kullaniciRes !== undefined && 
            kiraciRes !== null && kiraciRes !== undefined) {
          console.log("✅ Her iki tablo da başarıyla güncellendi!");

          // Doğrulama: Backend'den tekrar çek ve kontrol et (opsiyonel - hata olsa bile devam et)
          try {
            // Kullanici doğrulaması
            let verifyUser = null;
            try {
              verifyUser = await API.get(`/Kullanici/${kullaniciID}`);
            } catch (userError) {
              console.warn("⚠️ Kullanici doğrulaması yapılamadı:", userError);
            }

            // Kiraci doğrulaması - 405 hatası alınırsa direkt fallback kullan (sessiz)
            let verifyTenant = null;
            // Önce GET /Kiraci/{id} dene (backend güncellenmişse çalışır)
            verifyTenant = await API.get(`/Kiraci/${id}`);
            
            // Eğer null döndüyse (405 hatası veya başka bir hata), fallback kullan
            if (!verifyTenant) {
              // Sessizce fallback'e geç (405 hatası normal bir durum)
              const allTenants = await API.get("/Kiraci");
              if (allTenants && Array.isArray(allTenants)) {
                verifyTenant = allTenants.find(t => {
                  const tID = t.kiraciID || t.KiraciID;
                  return tID != null && (tID == id || tID.toString() === id.toString() || parseInt(tID) === parseInt(id));
                });
              }
            }
            
            if (verifyTenant) {
              console.log("✅ Kiraci doğrulaması başarılı:", verifyTenant);
            } else {
              console.warn("⚠️ Kiraci doğrulaması yapılamadı (fallback de başarısız)");
            }

            // Sadece başarılı doğrulamalar varsa kontrol et
            if (verifyUser || verifyTenant) {
              const userAdSoyad = verifyUser ? (verifyUser.adSoyad || verifyUser.AdSoyad || "").trim() : null;
              const userEmail = verifyUser ? (verifyUser.email || verifyUser.Email || "").trim().toLowerCase() : null;
              const tenantAdSoyad = verifyTenant ? (verifyTenant.adSoyad || verifyTenant.AdSoyad || "").trim() : null;
              const tenantEmail = verifyTenant ? (verifyTenant.email || verifyTenant.Email || "").trim().toLowerCase() : null;

              console.log("🔍 Doğrulama sonuçları:", {
                kullanici: verifyUser ? { adSoyad: userAdSoyad, email: userEmail } : "Doğrulanamadı",
                kiraci: verifyTenant ? { adSoyad: tenantAdSoyad, email: tenantEmail } : "Doğrulanamadı",
                beklenen: { adSoyad: data.adSoyad.trim(), email: data.email }
              });

              // Senkronizasyon kontrolü (sadece doğrulanabilen veriler için)
              let syncOk = true;
              if (verifyUser && (userAdSoyad !== data.adSoyad.trim() || userEmail !== data.email)) {
                syncOk = false;
              }
              if (verifyTenant && (tenantAdSoyad !== data.adSoyad.trim() || tenantEmail !== data.email)) {
                syncOk = false;
              }

              if (syncOk && (verifyUser || verifyTenant)) {
                console.log("✅✅ Senkronizasyon başarılı! Doğrulanabilen tablolarda aynı bilgiler var.");
              } else if (!syncOk) {
                console.warn("⚠️ Senkronizasyon uyarısı:", {
                  kullaniciAdSoyad: userAdSoyad,
                  kiraciAdSoyad: tenantAdSoyad,
                  beklenenAdSoyad: data.adSoyad.trim(),
                  kullaniciEmail: userEmail,
                  kiraciEmail: tenantEmail,
                  beklenenEmail: data.email
                });
                showTenantMessage("Güncelleme yapıldı ancak senkronizasyon kontrolünde uyarı var. Lütfen sayfayı yenileyin ve kontrol edin.", "warning");
              }
            } else {
              console.log("ℹ️ Doğrulama yapılamadı, ancak güncelleme başarılı.");
            }
          } catch (verifyError) {
            console.error("❌ Doğrulama hatası:", verifyError);
            // Doğrulama hatası olsa bile güncelleme yapıldı, devam et
          }
        } else {
          console.warn("⚠️ Güncelleme yanıtları:", { kullaniciRes, kiraciRes });
          showTenantMessage("Güncelleme yapıldı ancak yanıt kontrolünde uyarı var.", "warning");
        }
      } catch (updateError) {
        console.error("❌ Güncelleme hatası:", updateError);
        showTenantMessage("Güncelleme sırasında hata oluştu: " + (updateError.message || "Bilinmeyen hata"), "error");
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
        return;
      }
        
        // Bildirim oluştur
        try {
          const tenantName = data.adSoyad;
          await Notifications.tenantUpdated(user.kullaniciID, tenantName);
        } catch (notifError) {
          // Sessiz hata yönetimi
        }
        
        // globalTenants array'ini manuel güncelle (anında görünsün)
        const updatedTenantIndex = globalTenants.findIndex(t => (t.kiraciID || t.KiraciID) == id);
        if (updatedTenantIndex !== -1) {
          globalTenants[updatedTenantIndex] = {
            ...globalTenants[updatedTenantIndex],
            adSoyad: data.adSoyad,
            AdSoyad: data.adSoyad,
            email: data.email,
            Email: data.email,
            telefon: data.telefon,
            Telefon: data.telefon,
            tcNo: data.tcNo,
            TCNo: data.tcNo,
            adres: data.adres,
            Adres: data.adres
          };
          
          // Filtrelenmiş listeyi de güncelle
          filteredTenants = [...globalTenants];
          
          // Tabloyu tamamen yeniden render et
          const tableBody = document.getElementById("tenantList");
          if (tableBody) {
            tableBody.innerHTML = ""; // Önce temizle
            
            if (filteredTenants.length > 0) {
              // Tüm satırları yeniden oluştur
              filteredTenants.forEach((t) => {
                renderTenantRow(t);
              });
            } else {
              tableBody.innerHTML = "<tr><td colspan='5' style='text-align:center; padding:2rem; color:#888;'>Henüz kayıtlı kiracınız yok.</td></tr>";
            }
          }
        }
        
        showTenantMessage("Kiracı bilgileri başarıyla güncellendi.", "success");
        closeModal();
        
        // Backend'den fresh data çek (arka planda - güncel veriler için)
        setTimeout(() => {
          loadTenants(user.kullaniciID).catch(err => {
            console.error("Kiracı listesi yenilenirken hata:", err);
          });
        }, 500);
    } else {
      // YENİ EKLEME KALDIRILDI - Artık sadece sözleşme ekleme sayfasından email ile ekleniyor
      document.getElementById("formError").innerText = "Yeni kiracı eklemek için sözleşme oluşturma sayfasını kullanın.";
      document.getElementById("formError").style.display = "block";
      submitBtn.innerText = originalText;
      submitBtn.disabled = false;
      return;
    }
  } catch (error) {
    // Backend'den gelen detaylı hata mesajını al
    let errorMsg = error.message || error.toString() || "İşlem başarısız";
    
    // Eğer error.response varsa (API.js'den gelen detaylı hata)
    if (error.response) {
      if (error.response.message) {
        errorMsg = error.response.message;
      } else if (error.response.title) {
        errorMsg = error.response.title;
      } else if (error.response.errors) {
        // Validation errors
        const errorMessages = [];
        for (const key in error.response.errors) {
          if (Array.isArray(error.response.errors[key])) {
            errorMessages.push(...error.response.errors[key]);
          }
        }
        if (errorMessages.length > 0) {
          errorMsg = errorMessages.join(", ");
        }
      }
    }
    
    // Backend'den gelen hata mesajlarını kontrol et
    const lowerErrorMsg = errorMsg.toLowerCase();
    
    // E-posta ile ilgili hatalar
    if (lowerErrorMsg.includes("email") || lowerErrorMsg.includes("e-posta") || lowerErrorMsg.includes("eposta")) {
      document.getElementById("emailError").innerText = errorMsg;
      document.getElementById("emailError").style.display = "block";
      document.getElementById("formError").style.display = "none";
    } else {
      // Genel hata mesajı
      document.getElementById("formError").innerText = "Hata: " + errorMsg;
      document.getElementById("formError").style.display = "block";
      document.getElementById("emailError").style.display = "none";
    }
  } finally {
    submitBtn.innerText = originalText;
    submitBtn.disabled = false;
  }
});

// Eski yeni ekleme kodu kaldırıldı - artık sadece düzenleme yapılıyor
/*
      // YENİ EKLEME (POST) - Email duplicate kontrolü kaldırıldı
      // Backend zaten kontrol edecek, frontend'de kontrol yapmıyoruz
      // Çünkü kontrol başarısız olursa yanlış hata verebiliyor
      
      // Random şifre oluştur
      const randomPassword = generateRandomPassword(10);
      
      // Şifrenin doğru oluşturulduğundan emin ol
      if (!randomPassword || randomPassword.trim() === "") {
        document.getElementById("formError").innerText = "Şifre oluşturulamadı. Lütfen tekrar deneyin.";
        document.getElementById("formError").style.display = "block";
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
        return;
      }
      
      // ÖNCE Kullanici tablosuna kaydet (şifre burada kaydedilecek)
      // Önce /Kullanici/register endpoint'ini dene
      // Email zaten lowercase ve trim edilmiş (yukarıda yapıldı)
      const registerData1 = {
        adSoyad: data.adSoyad.trim(),
        email: data.email, // Email zaten lowercase ve trim edilmiş
        sifre: randomPassword, // Random şifre ile kayıt - Backend hash'leyecek
        rol: "Tenant"
      };
      
      // Telefon sadece doluysa ekle (backend null kabul etmeyebilir)
      if (data.telefon && data.telefon.trim()) {
        registerData1.telefon = data.telefon.trim();
      }
      
      let registerSuccess = false;
      let newUserId = null;
      let registerError = null;
      
      try {
        const registerResult = await API.post("/Kullanici/register", registerData1);
        if (registerResult !== null && registerResult !== undefined) {
          registerSuccess = true;
          // Kullanıcı ID'sini al
          if (registerResult.kullaniciID) {
            newUserId = registerResult.kullaniciID;
          } else if (registerResult.id) {
            newUserId = registerResult.id;
          }
        }
      } catch (registerError1) {
        registerError = registerError1;
        // Hata mesajını kontrol et
        const errorMsg1 = registerError1.message || "";
        const lowerErrorMsg1 = errorMsg1.toLowerCase();
        
        // Eğer kullanıcı zaten varsa, email ile kullanıcıyı bul
        if (lowerErrorMsg1.includes("zaten") || lowerErrorMsg1.includes("duplicate") || lowerErrorMsg1.includes("kayıtlı") || lowerErrorMsg1.includes("already")) {
          try {
            // Kullanıcıyı email ile bul
            const allUsers = await API.get("/Kullanici");
            if (allUsers && Array.isArray(allUsers)) {
              const existingUser = allUsers.find(u => {
                const uEmail = (u.email || u.Email || "").trim().toLowerCase();
                return uEmail === data.email; // data.email zaten lowercase
              });
              if (existingUser) {
                newUserId = existingUser.kullaniciID || existingUser.KullaniciID;
                registerSuccess = true; // Kullanıcı zaten var, devam et
              }
            }
          } catch (findError) {
            // Kullanıcı bulunamadı, devam et
          }
        }
        
        // Eğer hala başarısızsa /Register endpoint'ini dene
        if (!registerSuccess) {
          const registerData2 = {
            adSoyad: data.adSoyad.trim(),
            email: data.email.trim(),
            sifre: randomPassword, // Random şifre ile kayıt - Backend hash'leyecek
            rolAdi: "Tenant"
          };
          
          // Telefon sadece doluysa ekle (backend null kabul etmeyebilir)
          if (data.telefon && data.telefon.trim()) {
            registerData2.telefon = data.telefon.trim();
          }
          
          try {
            const registerResult2 = await API.post("/Register", registerData2);
            if (registerResult2 !== null && registerResult2 !== undefined) {
              registerSuccess = true;
              // Kullanıcı ID'sini al
              if (registerResult2.kullaniciID) {
                newUserId = registerResult2.kullaniciID;
              } else if (registerResult2.id) {
                newUserId = registerResult2.id;
              }
            }
          } catch (registerError2) {
            registerError = registerError2; // Hata mesajını sakla
            // Eğer kullanıcı zaten varsa hata verme (sessizce devam et)
            const errorMsg2 = registerError2.message || "";
            const lowerErrorMsg2 = errorMsg2.toLowerCase();
            if (lowerErrorMsg2.includes("zaten") || lowerErrorMsg2.includes("duplicate") || lowerErrorMsg2.includes("kayıtlı") || lowerErrorMsg2.includes("already")) {
              try {
                // Kullanıcıyı email ile bul
                const allUsers = await API.get("/Kullanici");
                if (allUsers && Array.isArray(allUsers)) {
                  const existingUser = allUsers.find(u => {
                    const uEmail = (u.email || u.Email || "").trim().toLowerCase();
                    return uEmail === data.email.trim().toLowerCase();
                  });
                  if (existingUser) {
                    newUserId = existingUser.kullaniciID || existingUser.KullaniciID;
                    registerSuccess = true; // Kullanıcı zaten var, devam et
                    registerError = null; // Başarılı oldu, hata yok
                  }
                }
              } catch (findError) {
                // Kullanıcı bulunamadı
              }
            }
            // Başka bir hata varsa, registerSuccess zaten false, hata mesajı registerError'da
          }
        }
      }
      
      // Eğer register başarısız olduysa, hata ver
      if (!registerSuccess) {
        // Backend'den gelen detaylı hata mesajını kullan
        let errorMsg = "Kullanıcı kaydı oluşturulamadı. Lütfen tekrar deneyin.";
        if (registerError) {
          const backendError = registerError.message || registerError.toString();
          if (backendError && backendError !== "İşlem başarısız") {
            errorMsg = backendError;
          }
        }
        throw new Error(errorMsg);
      }
      
      // SONRA Kiraci tablosuna kaydet
      // Backend KiraciCreateDto bekliyor ve Sifre alanı var
      // data objesine sifre ekle
      data.sifre = randomPassword;
      
      let res;
      try {
        res = await API.post("/Kiraci", data);
      } catch (kiraciError) {
        // Kiraci kaydı başarısız oldu, detaylı hata mesajı al
        let errorMsg = "Kiracı kaydı oluşturulamadı. Lütfen tekrar deneyin.";
        
        // Backend'den gelen detaylı hata mesajını al
        if (kiraciError && kiraciError.message) {
          errorMsg = kiraciError.message;
        }
        
        // Eğer error.response varsa (API.js'den gelen detaylı hata)
        if (kiraciError && kiraciError.response) {
          if (kiraciError.response.message) {
            errorMsg = kiraciError.response.message;
          } else if (kiraciError.response.title) {
            errorMsg = kiraciError.response.title;
          } else if (kiraciError.response.errors) {
            // Validation errors
            const errorMessages = [];
            for (const key in kiraciError.response.errors) {
              if (Array.isArray(kiraciError.response.errors[key])) {
                errorMessages.push(...kiraciError.response.errors[key]);
              }
            }
            if (errorMessages.length > 0) {
              errorMsg = errorMessages.join(", ");
            }
          }
        }
        
        throw new Error(errorMsg);
      }
      
      // Eğer res null veya undefined ise, hata fırlat
      if (res === null || res === undefined) {
        throw new Error("Kiracı kaydı oluşturulamadı. Sunucu yanıt vermedi.");
      }
      
      // Başarılı - Bildirim oluştur
      try {
        const tenantName = data.adSoyad;
        const tenantEmail = data.email;
        
        // Mülk sahibine bildirim gönder (şifre bilgisiyle)
        await Notifications.create(
          user.kullaniciID,
          "Yeni Kiracı Eklendi",
          `${tenantName} (${tenantEmail}) sisteme yeni kiracı olarak eklendi. Kiracı şifresi: ${randomPassword} - Bu şifreyle giriş yapabilir.`
        );
      } catch (notifError) {
        // Sessiz hata yönetimi
      }
      
      // Yeni eklenen kiracıyı direkt listeye ekle
      const newTenantID = res.kiraciID || res.KiraciID;
      
      // Modal'ı önce kapat (kullanıcı deneyimi için)
      closeModal();
      
      // Listeyi yeniden yükle (en güvenli yöntem - backend'den güncel veri)
      try {
        await loadTenants(user.kullaniciID);
      } catch (loadError) {
        // Liste yükleme hatası, sessizce devam et
      }
      
      // Şifre modal'ını aç
      showPasswordModal(data.adSoyad, data.email, randomPassword);
    }
  } catch (error) {
    // Backend'den gelen detaylı hata mesajını al
    let errorMsg = error.message || error.toString() || "İşlem başarısız";
    
    // Eğer error.response varsa (API.js'den gelen detaylı hata)
    if (error.response) {
      if (error.response.message) {
        errorMsg = error.response.message;
      } else if (error.response.title) {
        errorMsg = error.response.title;
      } else if (error.response.errors) {
        // Validation errors
        const errorMessages = [];
        for (const key in error.response.errors) {
          if (Array.isArray(error.response.errors[key])) {
            errorMessages.push(...error.response.errors[key]);
          }
        }
        if (errorMessages.length > 0) {
          errorMsg = errorMessages.join(", ");
        }
      }
    }
    
    // Backend'den gelen hata mesajlarını kontrol et
    const lowerErrorMsg = errorMsg.toLowerCase();
    
    // E-posta ile ilgili hatalar
    if (lowerErrorMsg.includes("email") || lowerErrorMsg.includes("e-posta") || lowerErrorMsg.includes("eposta") || lowerErrorMsg.includes("kiracı listesinde") || lowerErrorMsg.includes("kiracı olarak kayıtlı")) {
      // E-posta hatası - backend'den gelen mesajı göster
      // Eğer "kiracı listesinde" hatası varsa, backend kontrolünde sorun olabilir
      // Bu durumda kullanıcıya daha açıklayıcı bir mesaj göster
      let displayMsg = errorMsg;
      
      // Eğer "kiracı listesinde" hatası varsa, backend kontrolünde sorun olabilir
      // Kullanıcı e-posta kayıtlı değil diyor ama backend hata veriyor
      if (lowerErrorMsg.includes("kiracı listesinde")) {
        displayMsg = errorMsg + "\n\n⚠️ Not: Eğer bu e-posta gerçekten kayıtlı değilse, lütfen sayfayı yenileyin ve tekrar deneyin. Sorun devam ederse admin ile iletişime geçin.";
      }
      
      document.getElementById("emailError").innerText = displayMsg;
      document.getElementById("emailError").style.display = "block";
      document.getElementById("formError").style.display = "none";
    } else {
      // Genel hata mesajı
      document.getElementById("formError").innerText = "Hata: " + errorMsg;
      document.getElementById("formError").style.display = "block";
      document.getElementById("emailError").style.display = "none";
    }
  } finally {
    submitBtn.innerText = originalText;
    submitBtn.disabled = false;
  }
}); */

// Şifre Bilgisi Modal'ını Göster
function showPasswordModal(tenantName, tenantEmail, password) {
  document.getElementById("passwordModalTenantName").innerText = tenantName;
  document.getElementById("passwordModalEmail").innerText = tenantEmail;
  document.getElementById("passwordText").innerText = password;
  document.getElementById("passwordInfoModal").style.display = "flex";
  // Kopyalama feedback'ini gizle
  document.getElementById("passwordCopyFeedback").style.display = "none";
}

// Şifre Bilgisi Modal'ını Kapat
window.closePasswordModal = function() {
  document.getElementById("passwordInfoModal").style.display = "none";
};

// Şifreyi Panoya Kopyala
window.copyPasswordToClipboard = function() {
  const passwordText = document.getElementById("passwordText").innerText;
  if (passwordText && passwordText !== "-") {
    navigator.clipboard.writeText(passwordText).then(() => {
      const feedback = document.getElementById("passwordCopyFeedback");
      feedback.style.display = "block";
      setTimeout(() => {
        feedback.style.display = "none";
      }, 2000);
    }).catch(() => {
      // Fallback: Eski yöntem
      const textArea = document.createElement("textarea");
      textArea.value = passwordText;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        const feedback = document.getElementById("passwordCopyFeedback");
        feedback.style.display = "block";
        setTimeout(() => {
          feedback.style.display = "none";
        }, 2000);
      } catch (err) {
        // Kopyalama başarısız
      }
      document.body.removeChild(textArea);
    });
  }
};

// Kiracı Silme
let tenantToDelete = null;

// DELETE metodu backend'de yok - Silme özelliği devre dışı
window.deleteTenant = function(id) {
  showTenantMessage("Backend'de DELETE metodu bulunmadığı için silme işlemi yapılamıyor.", "error");
};

window.closeDeleteModal = function() {
  document.getElementById("deleteTenantModal").style.display = "none";
  tenantToDelete = null;
  document.getElementById("deleteError").style.display = "none";
};

// DELETE metodu backend'de yok - Silme özelliği devre dışı
window.confirmDeleteTenant = async function() {
  showTenantMessage("Backend'de DELETE metodu bulunmadığı için silme işlemi yapılamıyor.", "error");
  closeDeleteModal();
};

// Mesaj Gösterme
function showTenantMessage(message, type = "success") {
  const container = document.getElementById("tenantMessage");
  const messageClass = type === "error" ? "error-message" : "success-message";
  const icon = type === "error" ? "fa-triangle-exclamation" : "fa-check-circle";
  
  container.innerHTML = `
    <div class="${messageClass}" style="background:${type === "error" ? "rgba(255,75,92,0.1)" : "rgba(0,200,83,0.1)"}; border:1px solid ${type === "error" ? "#ff4b5c" : "#00c853"}; color:${type === "error" ? "#ff4b5c" : "#00c853"}; padding:12px; border-radius:8px; margin-bottom:1rem; display:flex; align-items:center; gap:8px;">
      <i class="fa-solid ${icon}"></i> ${message}
    </div>
  `;
  
  setTimeout(() => {
    container.innerHTML = "";
  }, 5000);
}

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});
