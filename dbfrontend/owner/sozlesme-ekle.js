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
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);

  // --- 1. SAYFA YÜKLENİRKEN DROPDOWNLARI DOLDUR ---
  try {
    // Mülkleri Çek
    const mulkler = await API.get(`/Mulk?sahipId=${user.kullaniciID}`);
    if (mulkler && Array.isArray(mulkler)) {
      populateMulkSelect(mulkler);
    } else {
      // Mülk yoksa dropdown'ı güncelle
      const sel = document.getElementById("mulkSelect");
      if (sel) {
        sel.innerHTML = '<option value="">Mülk bulunamadı</option>';
      }
    }

    // Para Birimlerini Çek
    const sozluk = await API.get("/sozluk/all");
    if (sozluk) {
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
    // Hata durumunda dropdown'ı güncelle
    const sel = document.getElementById("mulkSelect");
    if (sel) {
      sel.innerHTML = '<option value="">Mülkler yüklenemedi</option>';
    }
  }

  // --- 2. FORM GÖNDERME İŞLEMİ ---
  document
    .getElementById("createContractForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = document.querySelector(".btn-save");
      const originalText = submitBtn.innerText;
      submitBtn.innerText = "İşleniyor...";
      submitBtn.disabled = true;

      try {
        // Sadece email ile kiracı ekleme
        let selectedKiraciID = null;
        
        const email = document.getElementById("emailEmail").value.trim().toLowerCase();
        
        if (!email) {
          throw new Error("Lütfen E-posta alanını doldurunuz.");
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error("Geçerli bir e-posta adresi giriniz.");
        }

        // Sistemde bu kiracı var mı kontrol et (tüm kiracılar - aktif ve pasif)
        let sistemdekiKiraci = null;
        try {
          // Önce tüm kiracıları kontrol et
          const tumKiracilar = await API.get("/Kiraci");
          if (tumKiracilar && Array.isArray(tumKiracilar)) {
            sistemdekiKiraci = tumKiracilar.find(k => {
              const kEmail = (k.email || k.Email || "").trim().toLowerCase();
              return kEmail && kEmail === email;
            });
          }
          
          // Eğer bulunamazsa aktif olanları kontrol et
          if (!sistemdekiKiraci) {
            const aktifKiracilar = await API.get("/Kiraci/aktif");
            if (aktifKiracilar && Array.isArray(aktifKiracilar)) {
              sistemdekiKiraci = aktifKiracilar.find(k => {
                const kEmail = (k.email || k.Email || "").trim().toLowerCase();
                return kEmail && kEmail === email;
              });
            }
          }
        } catch (checkError) {
          // Kontrol başarısız olsa da devam et
        }

        if (sistemdekiKiraci) {
          // Kiracı zaten sistemde var, onu kullan
          selectedKiraciID = sistemdekiKiraci.kiraciID || sistemdekiKiraci.KiraciID;
        } else {
          // Yeni kiracı oluştur - Sadece email ile (Ad Soyad email'den çıkarılacak)
          const randomPassword = generateRandomPassword(10);
          
          if (!randomPassword || randomPassword.trim() === "") {
            throw new Error("Şifre oluşturulamadı");
          }
          
          // Email'den ad soyad çıkar (email'in @ öncesi kısmı)
          const emailPrefix = email.split("@")[0];
          const adSoyad = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1); // İlk harfi büyük yap
          
          // Önce Kullanici tablosuna kaydet
          const registerData1 = {
            adSoyad: adSoyad,
            email: email,
            telefon: null,
            sifre: randomPassword,
            rol: "Tenant"
          };
          
          let registerSuccess = false;
          try {
            const registerResult = await API.post("/Kullanici/register", registerData1);
            if (registerResult !== null && registerResult !== undefined) {
              registerSuccess = true;
            }
          } catch (registerError1) {
            const registerData2 = {
              adSoyad: adSoyad,
              email: email,
              telefon: null,
              sifre: randomPassword,
              rolAdi: "Tenant"
            };
            
            try {
              const registerResult2 = await API.post("/Register", registerData2);
              if (registerResult2 !== null && registerResult2 !== undefined) {
                registerSuccess = true;
              }
            } catch (registerError2) {
              const errorMsg = registerError2.message || registerError1.message || "";
              if (errorMsg.includes("zaten") || errorMsg.includes("duplicate") || errorMsg.includes("kayıtlı") || errorMsg.includes("already")) {
                registerSuccess = true;
              }
            }
          }
          
          // Sonra Kiraci tablosuna kaydet
          // Backend'deki Create metodu KullaniciID ile Kiraci kaydı oluşturuyor
          const newTenantData = {
            adSoyad: adSoyad,
            email: email,
            sifre: randomPassword, // Backend CreateKiraciRequest bekliyor
            telefon: null,
            tcNo: null
          };

          const tenantResult = await API.post("/Kiraci", newTenantData);

          if (tenantResult && (tenantResult.kiraciID || tenantResult.KiraciID)) {
            selectedKiraciID = tenantResult.kiraciID || tenantResult.KiraciID;
            
            // Backend'deki Create metodu zaten KullaniciID ekliyor
            // Kontrol et: Kiraci kaydında KullaniciID var mı?
            try {
              const createdTenant = await API.get(`/Kiraci/${selectedKiraciID}`);
              if (createdTenant && (createdTenant.kullaniciID || createdTenant.KullaniciID)) {
                console.log("✅ Kiraci kaydına KullaniciID başarıyla eklendi:", createdTenant.kullaniciID || createdTenant.KullaniciID);
              } else {
                console.warn("⚠️ Kiraci kaydında KullaniciID bulunamadı, backend Create metodu kontrol edilmeli.");
              }
            } catch (checkError) {
              // Fallback: Tüm kiracılar listesinden kontrol et
              try {
                const allTenants = await API.get("/Kiraci");
                if (allTenants && Array.isArray(allTenants)) {
                  const createdTenant = allTenants.find(t => {
                    const tID = t.kiraciID || t.KiraciID;
                    return tID != null && (tID == selectedKiraciID || tID.toString() === selectedKiraciID.toString());
                  });
                  if (createdTenant && (createdTenant.kullaniciID || createdTenant.KullaniciID)) {
                    console.log("✅ Kiraci kaydına KullaniciID başarıyla eklendi (fallback):", createdTenant.kullaniciID || createdTenant.KullaniciID);
                  }
                }
              } catch (fallbackError) {
                console.warn("⚠️ KullaniciID kontrolü yapılamadı:", fallbackError);
              }
            }
            
            // Şifre bilgisini sakla (modal için)
            window.pendingPasswordInfo = {
              tenantName: adSoyad,
              tenantEmail: email,
              password: randomPassword
            };
              
            // Bildirim gönder
            try {
              await Notifications.create(
                user.kullaniciID,
                "Yeni Kiracı Eklendi",
                `${adSoyad} (${email}) sisteme yeni kiracı olarak eklendi. Kiracı şifresi: ${randomPassword} - Bu şifreyle giriş yapabilir.`
              );
            } catch (notifError) {
              // Sessiz hata yönetimi
            }
          } else {
            throw new Error("Kiracı oluşturulamadı.");
          }
        }

        // --- 3. TARİH ÇAKIŞMA KONTROLÜ (Frontend) ---
        const selectedMulkID = document.getElementById("mulkSelect").value;
        const baslangicTarihi = document.getElementById("baslangic").value;
        const bitisTarihi = document.getElementById("bitis").value || null;
        
        // Aynı mülk için mevcut sözleşmeleri kontrol et
        try {
          const existingContracts = await API.get(`/KiraSozlesme?userId=${user.kullaniciID}&role=Owner`);
          const mulkContracts = existingContracts?.filter(c => 
            (c.mulkID || c.MulkID) == selectedMulkID && 
            (c.aktifMi !== false) // Aktif sözleşmeler
          ) || [];
          
          const newStart = new Date(baslangicTarihi);
          const newEnd = bitisTarihi ? new Date(bitisTarihi) : null;
          
          for (const existing of mulkContracts) {
            const existingStart = new Date(existing.baslangicTarihi || existing.BaslangicTarihi);
            const existingEnd = existing.bitisTarihi || existing.BitisTarihi 
              ? new Date(existing.bitisTarihi || existing.BitisTarihi)
              : null;
            
            // Tarih çakışma kontrolü
            const overlaps = (
              (newEnd === null || newEnd >= existingStart) && 
              (existingEnd === null || existingEnd >= newStart)
            );
            
            if (overlaps) {
              const mulkBaslik = existing.mulkBaslik || existing.MulkBaslik || "Mülk";
              const existingStartStr = existingStart.toLocaleDateString("tr-TR");
              const existingEndStr = existingEnd ? existingEnd.toLocaleDateString("tr-TR") : "Süresiz";
              
              throw new Error(
                `Bu mülk için tarih çakışması var!\n\n` +
                `Mevcut aktif sözleşme:\n` +
                `Başlangıç: ${existingStartStr}\n` +
                `Bitiş: ${existingEndStr}\n\n` +
                `Lütfen tarihleri kontrol edin.`
              );
            }
          }
        } catch (checkError) {
          if (checkError.message.includes("çakışma") || checkError.message.includes("overlap")) {
            throw checkError; // Tarih çakışma hatasını yukarı fırlat
          }
          // Diğer hatalar için devam et (backend zaten kontrol edecek)
        }

        // --- 4. SÖZLEŞMEYİ KAYDET ---
        const contractData = {
          mulkID: selectedMulkID,
          kiraciID: selectedKiraciID,
          aylikKiraTutar: document.getElementById("tutar").value,
          paraBirimiID: document.getElementById("paraBirimi").value,
          odemeGunu: document.getElementById("odemeGunu").value,
          baslangicTarihi: baslangicTarihi,
          bitisTarihi: bitisTarihi,
          depozitoTutar: document.getElementById("depozito").value || 0,
          aktifMi: true,
        };

        const contractResult = await API.post("/KiraSozlesme", contractData);

        if (contractResult) {
          // Bildirim oluştur
          try {
            // Mülk ve kiracı bilgilerini al
            const mulkSelect = document.getElementById("mulkSelect");
            const selectedMulk = mulkSelect.options[mulkSelect.selectedIndex]?.text || "Mülk";
            
            let tenantName = "Kiracı";
            let tenantKullaniciID = null;
            
            // Kiracının KullaniciID'sini bul (KiraciID'den KullaniciID'ye çevir)
            if (selectedKiraciID) {
              try {
                // Tüm kiracıları çek ve bu kiracıyı bul
                const tumKiracilar = await API.get("/Kiraci/aktif");
                const kiraci = tumKiracilar?.find(
                  (k) => (k.kiraciID || k.KiraciID) == selectedKiraciID
                );
                
                if (kiraci) {
                  tenantName = kiraci.adSoyad || kiraci.AdSoyad || "Kiracı";
                  // Kiracının KullaniciID'sini al (eğer varsa)
                  tenantKullaniciID = kiraci.kullaniciID || kiraci.KullaniciID || null;
                } else {
                  // Email'den kiracı adını al
                  const emailValue = document.getElementById("emailEmail").value.trim();
                  if (emailValue) {
                    const emailPrefix = emailValue.split("@")[0];
                    tenantName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
                  } else {
                    tenantName = "Kiracı";
                  }
                }
              } catch (kiraciError) {
                // Sessiz hata yönetimi
                const emailValue = document.getElementById("emailEmail")?.value?.trim();
                if (emailValue) {
                  const emailPrefix = emailValue.split("@")[0];
                  tenantName = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
                } else {
                  tenantName = "Kiracı";
                }
              }
            }
            
            // Ev sahibine bildirim
            await Notifications.contractCreated(user.kullaniciID, tenantName, selectedMulk);
            
            // Kiracıya bildirim (eğer kiracının KullaniciID'si varsa)
            if (tenantKullaniciID) {
              await Notifications.contractCreatedForTenant(tenantKullaniciID, selectedMulk, user.adSoyad);
            }
            
            // Admin'e bildirim
            await Notifications.contractCreatedForAdmin(user.adSoyad, tenantName, selectedMulk);
              } catch (notifError) {
                // Sessiz hata yönetimi
              }
          
          // Eğer yeni kiracı oluşturulduysa ve şifre bilgisi varsa, modal'ı göster
          if (window.pendingPasswordInfo) {
            showPasswordModal(
              window.pendingPasswordInfo.tenantName,
              window.pendingPasswordInfo.tenantEmail,
              window.pendingPasswordInfo.password
            );
            window.pendingPasswordInfo = null;
          } else {
            alert("İşlem Başarılı!\n\nSözleşme oluşturuldu ve ilk ayın ödeme planı otomatik eklendi.");
            window.location.href = "sozlesmeler.html";
          }
        }
      } catch (error) {
        const errorMsg = error.message || "Bir hata oluştu.";
        
        // Backend'den gelen hata mesajlarını kontrol et
        if (errorMsg.includes("çakışma") || errorMsg.includes("overlap") || errorMsg.includes("conflict")) {
          alert("❌ Tarih Çakışması!\n\n" + errorMsg);
        } else if (errorMsg.includes("Kira") || errorMsg.includes("tutar")) {
          alert("❌ Ödeme Hatası!\n\n" + errorMsg);
        } else {
          alert("❌ Hata: " + errorMsg);
        }
      } finally {
        submitBtn.innerText = originalText;
        submitBtn.disabled = false;
      }
    });
});

// --- YARDIMCI FONKSİYONLAR ---

function populateMulkSelect(list) {
  const sel = document.getElementById("mulkSelect");
  if (!sel) return;
  
  sel.innerHTML = '<option value="">Mülk Seçiniz...</option>';
  
  if (!list || !Array.isArray(list) || list.length === 0) {
    sel.innerHTML = '<option value="">Mülk bulunamadı</option>';
    return;
  }
  
  let hasActiveProperties = false;
  list.forEach((m) => {
    const aktif = m.aktifMi !== undefined ? m.aktifMi : m.AktifMi;
    const baslik = m.baslik || m.Baslik || "İsimsiz Mülk";
    const id = m.mulkID || m.MulkID;
    
    if (aktif && id) {
      const opt = document.createElement("option");
      opt.value = id;
      opt.text = baslik;
      sel.appendChild(opt);
      hasActiveProperties = true;
    }
  });
  
  if (!hasActiveProperties) {
    sel.innerHTML = '<option value="">Aktif mülk bulunamadı</option>';
  }
}

// Kiracı seçim dropdown'ı kaldırıldı, artık sadece email ile ekleme yapılıyor

// Şifre Bilgisi Modal'ını Göster
function showPasswordModal(tenantName, tenantEmail, password) {
  document.getElementById("passwordModalTenantName").innerText = tenantName;
  document.getElementById("passwordModalEmail").innerText = tenantEmail;
  document.getElementById("passwordText").innerText = password;
  document.getElementById("passwordInfoModal").style.display = "flex";
  document.getElementById("passwordCopyFeedback").style.display = "none";
}

// Şifre Bilgisi Modal'ını Kapat
window.closePasswordModal = function() {
  document.getElementById("passwordInfoModal").style.display = "none";
  alert("İşlem Başarılı!\n\nSözleşme oluşturuldu ve ilk ayın ödeme planı otomatik eklendi.");
  window.location.href = "sozlesmeler.html";
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

document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});
