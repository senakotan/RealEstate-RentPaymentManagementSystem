// Bildirim Oluşturma Yardımcı Fonksiyonu
const Notifications = {
  // Bildirim oluştur
  create: async function (kullaniciID, baslik, mesaj) {
    try {
      if (!kullaniciID) {
        return;
      }
      
      // Backend'in beklediği formata göre düzenle (hem küçük hem büyük harf deniyoruz)
      const data = {
        kullaniciID: kullaniciID,
        KullaniciID: kullaniciID,
        baslik: baslik,
        Baslik: baslik,
        mesaj: mesaj,
        Mesaj: mesaj,
        okunduMu: false,
        OkunduMu: false,
      };
      
      const result = await API.post("/Bildirim", data);
      return result;
    } catch (error) {
      // Bildirim oluşturulamazsa sessizce devam et (uygulama çalışmaya devam etsin)
    }
  },

  // Sözleşme oluşturulduğunda bildirim
  contractCreated: async function (ownerId, tenantName, propertyName) {
    await this.create(
      ownerId,
      "Yeni Sözleşme Oluşturuldu",
      `${propertyName} mülkü için ${tenantName} ile yeni bir sözleşme oluşturuldu.`
    );
  },

  // Ödeme yapıldığında bildirim
  paymentReceived: async function (ownerId, tenantName, amount, currency, propertyName) {
    await this.create(
      ownerId,
      "Ödeme Alındı",
      `${propertyName} mülkü için ${tenantName} kiracısından ${amount} ${currency} ödeme alındı.`
    );
  },

  // Bakım talebi oluşturulduğunda bildirim
  maintenanceRequestCreated: async function (ownerId, propertyName, description) {
    await this.create(
      ownerId,
      "Yeni Bakım Talebi",
      `${propertyName} mülkü için yeni bir bakım talebi oluşturuldu: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`
    );
  },

  // Bakım talebi güncellendiğinde bildirim
  maintenanceRequestUpdated: async function (ownerId, propertyName, status) {
    const statusText = status === "Tamamlandi" ? "tamamlandı" : 
                       status === "Devam Ediyor" ? "devam ediyor" : "açık";
    await this.create(
      ownerId,
      "Bakım Talebi Güncellendi",
      `${propertyName} mülkü için bakım talebi durumu "${statusText}" olarak güncellendi.`
    );
  },

  // Sözleşme sonlandırıldığında bildirim
  contractTerminated: async function (ownerId, tenantName, propertyName) {
    await this.create(
      ownerId,
      "Sözleşme Sonlandırıldı",
      `${propertyName} mülkü için ${tenantName} ile olan sözleşme sonlandırıldı.`
    );
  },

  // Kiracı eklendiğinde bildirim
  tenantAdded: async function (ownerId, tenantName) {
    await this.create(
      ownerId,
      "Yeni Kiracı Eklendi",
      `${tenantName} sisteme yeni kiracı olarak eklendi.`
    );
  },

  // Mülk eklendiğinde bildirim
  propertyAdded: async function (ownerId, propertyName) {
    await this.create(
      ownerId,
      "Yeni Mülk Eklendi",
      `${propertyName} mülkü sisteme eklendi.`
    );
  },

  // Kiracıdan bakım talebi geldiğinde bildirim
  maintenanceRequestFromTenant: async function (ownerId, tenantName, propertyName, description) {
    await this.create(
      ownerId,
      "Kiracıdan Bakım Talebi",
      `${propertyName} mülkü için ${tenantName} kiracısından bakım talebi geldi: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`
    );
  },

  // Ödeme geciktiğinde bildirim
  paymentLate: async function (ownerId, tenantName, propertyName, amount, currency) {
    await this.create(
      ownerId,
      "Geciken Ödeme",
      `${propertyName} mülkü için ${tenantName} kiracısından ${amount} ${currency} tutarındaki ödeme gecikti.`
    );
  },

  // Kiracı ödeme yaptığında kiracıya bildirim
  paymentMade: async function (tenantId, propertyName, amount, currency) {
    await this.create(
      tenantId,
      "Ödeme Yapıldı",
      `${propertyName} mülkü için ${amount} ${currency} tutarındaki ödemeniz başarıyla alındı.`
    );
  },

  // Sözleşme oluşturulduğunda kiracıya bildirim
  contractCreatedForTenant: async function (tenantId, propertyName, ownerName) {
    await this.create(
      tenantId,
      "Yeni Sözleşme",
      `${propertyName} mülkü için ${ownerName} ile sözleşme oluşturuldu.`
    );
  },

  // Bakım talebi güncellendiğinde kiracıya bildirim
  maintenanceRequestUpdatedForTenant: async function (tenantId, propertyName, status) {
    const statusText = status === "Tamamlandi" ? "tamamlandı" : 
                       status === "Devam Ediyor" ? "devam ediyor" : "açık";
    await this.create(
      tenantId,
      "Bakım Talebi Güncellendi",
      `${propertyName} mülkü için bakım talebiniz "${statusText}" olarak güncellendi.`
    );
  },

  // Sözleşme sonlandırıldığında kiracıya bildirim
  contractTerminatedForTenant: async function (tenantId, propertyName) {
    await this.create(
      tenantId,
      "Sözleşme Sonlandırıldı",
      `${propertyName} mülkü için sözleşmeniz sonlandırıldı.`
    );
  },

  // Kiracı güncellendiğinde bildirim
  tenantUpdated: async function (ownerId, tenantName) {
    await this.create(
      ownerId,
      "Kiracı Bilgileri Güncellendi",
      `${tenantName} kiracısının bilgileri güncellendi.`
    );
  },

  // Kiracı silindiğinde bildirim
  tenantDeleted: async function (ownerId, tenantName) {
    await this.create(
      ownerId,
      "Kiracı Silindi",
      `${tenantName} kiracısı sistemden silindi (pasife alındı).`
    );
  },

  // Mülk güncellendiğinde bildirim
  propertyUpdated: async function (ownerId, propertyName) {
    await this.create(
      ownerId,
      "Mülk Bilgileri Güncellendi",
      `${propertyName} mülkünün bilgileri güncellendi.`
    );
  },

  // Mülk silindiğinde bildirim
  propertyDeleted: async function (ownerId, propertyName) {
    await this.create(
      ownerId,
      "Mülk Silindi",
      `${propertyName} mülkü sistemden silindi (pasife alındı).`
    );
  },

  // Ödeme planı oluşturulduğunda bildirim
  paymentPlanCreated: async function (ownerId, propertyName, tenantName, amount, currency, dueDate) {
    const dateStr = dueDate ? new Date(dueDate).toLocaleDateString("tr-TR") : "";
    await this.create(
      ownerId,
      "Yeni Ödeme Planı Oluşturuldu",
      `${propertyName} mülkü için ${tenantName} kiracısına ${amount} ${currency} tutarında ödeme planı oluşturuldu. Vade: ${dateStr}`
    );
  },

  // Ödeme planı oluşturulduğunda kiracıya bildirim
  paymentPlanCreatedForTenant: async function (tenantId, propertyName, amount, currency, dueDate) {
    const dateStr = dueDate ? new Date(dueDate).toLocaleDateString("tr-TR") : "";
    await this.create(
      tenantId,
      "Yeni Ödeme Planı",
      `${propertyName} mülkü için ${amount} ${currency} tutarında ödeme planınız oluşturuldu. Vade: ${dateStr}`
    );
  },

  // Arıza bildirimi oluşturulduğunda kiracıya bildirim
  maintenanceRequestCreatedForTenant: async function (tenantId, propertyName, description) {
    await this.create(
      tenantId,
      "Arıza Bildirimi Gönderildi",
      `${propertyName} mülkü için arıza bildiriminiz gönderildi: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`
    );
  },

  // Admin'e bildirim gönder (tüm adminlere)
  notifyAdmins: async function (baslik, mesaj) {
    try {
      // Tüm kullanıcıları çek
      const allUsers = await API.get("/Kullanici");
      if (!Array.isArray(allUsers)) {
        return;
      }

      // Admin rolünü bul
      const roles = await API.get("/Rol");
      if (!Array.isArray(roles)) {
        return;
      }

      const adminRole = roles.find(r => {
        const rolAdi = (r.rolAdi || r.RolAdi || "").toLowerCase();
        return rolAdi === "admin";
      });

      if (!adminRole) {
        return;
      }

      const adminRoleId = adminRole.rolID || adminRole.RolID || adminRole.id || adminRole.ID;

      // Her kullanıcının rollerini kontrol et
      const adminPromises = [];
      for (const user of allUsers) {
        const userId = user.kullaniciID || user.KullaniciID || user.id || user.ID;
        if (!userId) continue;

        try {
          const userRoles = await API.get(`/KullaniciRol/user/${userId}`);
          if (Array.isArray(userRoles)) {
            // String array mi kontrol et
            const firstItem = userRoles[0];
            let hasAdminRole = false;

            if (typeof firstItem === 'string') {
              hasAdminRole = userRoles.some(r => r.toLowerCase() === "admin");
            } else {
              const roleIds = userRoles.map(ur => {
                const rol = ur.rol || ur.Rol || ur;
                return rol.rolID || rol.RolID || rol.id || rol.ID;
              });
              hasAdminRole = roleIds.includes(adminRoleId);
            }

            if (hasAdminRole) {
              adminPromises.push(this.create(userId, baslik, mesaj));
            }
          }
        } catch (roleError) {
          // Rol kontrolü yapılamadı
        }
      }

      // Tüm adminlere bildirim gönder
      await Promise.all(adminPromises);
    } catch (error) {
      // Admin bildirimi gönderme hatası
    }
  },

  // Yeni kullanıcı kaydı olduğunda admin'e bildirim
  newUserRegistered: async function (userName, userRole) {
    await this.notifyAdmins(
      "Yeni Kullanıcı Kaydı",
      `${userName} adlı yeni bir ${userRole} kullanıcısı sisteme kayıt oldu.`
    );
  },

  // Yeni sözleşme oluşturulduğunda admin'e bildirim
  contractCreatedForAdmin: async function (ownerName, tenantName, propertyName) {
    await this.notifyAdmins(
      "Yeni Sözleşme Oluşturuldu",
      `${ownerName} ve ${tenantName} arasında ${propertyName} mülkü için yeni bir sözleşme oluşturuldu.`
    );
  },

  // Ödeme yapıldığında admin'e bildirim
  paymentReceivedForAdmin: async function (ownerName, tenantName, amount, currency, propertyName) {
    await this.notifyAdmins(
      "Ödeme Alındı",
      `${propertyName} mülkü için ${ownerName} mülk sahibine ${tenantName} kiracısından ${amount} ${currency} ödeme alındı.`
    );
  },

  // Bakım talebi oluşturulduğunda admin'e bildirim
  maintenanceRequestForAdmin: async function (propertyName, description, requestorName) {
    await this.notifyAdmins(
      "Yeni Bakım Talebi",
      `${propertyName} mülkü için ${requestorName} tarafından yeni bir bakım talebi oluşturuldu: ${description.substring(0, 50)}${description.length > 50 ? '...' : ''}`
    );
  },
};

