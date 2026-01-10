document.addEventListener("DOMContentLoaded", async () => {
  // 1. Yetki ve Kullanıcı Kontrolü
  const userStr = localStorage.getItem("user");
  if (!userStr) {
    window.location.href = "../index.html";
    return;
  }
  const user = JSON.parse(userStr);
  if (user.rol !== "Tenant") {
    window.location.href = "../index.html";
    return;
  }

  // Profil Bilgilerini Header'a Yaz
  const headerName = document.getElementById("headerUserName");
  if (headerName) headerName.innerText = user.adSoyad;

  const userImg = document.getElementById("userImg");
  if (userImg)
    userImg.src = `https://ui-avatars.com/api/?name=${user.adSoyad}&background=764ba2&color=fff`;

  // Bildirimleri Yükle
  await loadNotifications(user.kullaniciID);
});

// Bildirimleri Listele
async function loadNotifications(userId) {
  const container = document.getElementById("notificationList");
  container.innerHTML =
    "<p style='color:#888; text-align:center;'>Yükleniyor...</p>";

  try {
    // Okunmamış sayısını al
    try {
      const unreadCount = await API.get(`/Bildirim/unread-count/${userId}`);
      if (unreadCount !== null && unreadCount !== undefined) {
        const badgeEl = document.getElementById("notificationBadge");
        if (badgeEl) {
          if (unreadCount > 0) {
            badgeEl.innerText = unreadCount;
            badgeEl.style.display = "inline-block";
          } else {
            badgeEl.style.display = "none";
          }
        }
      }
    } catch (e) {
      console.log("Unread count alınamadı:", e);
    }

    // Backend'in beklediği parametre adını deniyoruz
    let notifications = await API.get(`/Bildirim/kullanici/${userId}`);
    if (!notifications || notifications.length === 0) {
      // Alternatif parametre adıyla dene
      notifications = await API.get(`/Bildirim?KullaniciID=${userId}`);
    }
    if (!notifications || notifications.length === 0) {
      // Bir de userId ile dene
      notifications = await API.get(`/Bildirim?userId=${userId}`);
    }

    container.innerHTML = "";

    if (notifications && notifications.length > 0) {
      // Okunmamışları önce göster
      const sorted = notifications.sort((a, b) => {
        const aRead = a.okunduMu || a.OkunduMu || false;
        const bRead = b.okunduMu || b.OkunduMu || false;
        if (aRead === bRead) {
          // Aynı okunma durumundaysa tarihe göre sırala
          const aDate = new Date(a.olusturmaTarihi || a.OlusturmaTarihi);
          const bDate = new Date(b.olusturmaTarihi || b.OlusturmaTarihi);
          return bDate - aDate;
        }
        return aRead ? 1 : -1; // Okunmamışlar önce
      });

      sorted.forEach((n) => {
        const id = n.bildirimID || n.BildirimID;
        const baslik = n.baslik || n.Baslik || "Bildirim";
        const mesaj = n.mesaj || n.Mesaj || "";
        const okunduMu = n.okunduMu !== undefined ? n.okunduMu : n.OkunduMu;
        const tarihRaw = n.olusturmaTarihi || n.OlusturmaTarihi;

        const tarih = tarihRaw
          ? new Date(tarihRaw).toLocaleDateString("tr-TR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "-";

        const unreadClass = !okunduMu ? "unread" : "";
        const badgeHtml = !okunduMu
          ? '<span class="notification-badge"></span>'
          : "";

        const html = `
                    <div class="notification-card ${unreadClass}" onclick="markAsRead(${id})">
                        ${badgeHtml}
                        <div class="notification-header">
                            <div style="flex:1;">
                                <div class="notification-title">${baslik}</div>
                                <div class="notification-message">${mesaj}</div>
                                <div class="notification-date">
                                    <i class="fa-regular fa-clock"></i> ${tarih}
                                </div>
                            </div>
                        </div>
                        ${!okunduMu ? `<div class="notification-actions">
                            <button class="btn-mark-read" onclick="event.stopPropagation(); markAsRead(${id})">
                                <i class="fa-solid fa-check"></i> Okundu İşaretle
                            </button>
                        </div>` : ""}
                    </div>
                `;
        container.innerHTML += html;
      });
    } else {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fa-solid fa-bell-slash"></i>
                    <p>Henüz bildirim bulunmuyor.</p>
                </div>`;
    }
  } catch (err) {
    console.error(err);
    container.innerHTML =
      "<p style='color:red; text-align:center;'>Bildirimler yüklenirken hata oluştu.</p>";
  }
}

// Bildirimi Okundu İşaretle
window.markAsRead = async function (id) {
  try {
    const res = await API.put(`/Bildirim/read/${id}`, {});
    if (res) {
      // Sayfayı yenile
      const user = JSON.parse(localStorage.getItem("user"));
      await loadNotifications(user.kullaniciID);
    }
  } catch (error) {
    console.error("Bildirim okundu işaretleme hatası:", error);
  }
};

// Tümünü Okundu İşaretle
window.markAllAsRead = async function () {
  if (!confirm("Tüm bildirimleri okundu olarak işaretlemek istediğinize emin misiniz?")) {
    return;
  }

  try {
    const user = JSON.parse(localStorage.getItem("user"));
    
    // Backend'deki read-all endpoint'ini kullan
    try {
      const res = await API.put(`/Bildirim/read-all/${user.kullaniciID}`, {});
      if (res !== null) {
        alert("Tüm bildirimler okundu olarak işaretlendi.");
        await loadNotifications(user.kullaniciID);
        return;
      }
    } catch (e) {
      console.log("Read-all endpoint çalışmadı, manuel yönteme geçiliyor:", e);
    }

    // Fallback: Manuel döngü
    const notifications = await API.get(`/Bildirim/kullanici/${user.kullaniciID}`);
    if (notifications && notifications.length > 0) {
      const unreadNotifications = notifications.filter(
        (n) => !(n.okunduMu !== undefined ? n.okunduMu : n.OkunduMu)
      );

      for (const notif of unreadNotifications) {
        const id = notif.bildirimID || notif.BildirimID;
        await API.put(`/Bildirim/read/${id}`, {});
      }

      alert("Tüm bildirimler okundu olarak işaretlendi.");
      await loadNotifications(user.kullaniciID);
    }
  } catch (error) {
    console.error("Tümünü okundu işaretleme hatası:", error);
    alert("Bir hata oluştu.");
  }
};

// Çıkış
document.getElementById("btnLogout")?.addEventListener("click", () => {
  localStorage.removeItem("user");
  window.location.href = "../index.html";
});

