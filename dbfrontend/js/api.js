const BASE_URL = "https://localhost:7288/api";
const API = {
  // Genel GET isteği atan fonksiyon
  get: async (endpoint) => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`);
      if (!response.ok) throw new Error("Veri çekilemedi");
      return await response.json();
    } catch (error) {
      // Hata sessizce yakalanıyor, null döndürülüyor
      return null;
    }
  },

  // Genel POST isteği atan fonksiyon (Veri göndermek için)
  post: async (endpoint, data) => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      // Response body'yi sadece bir kez okumak için clone kullan
      const responseClone = response.clone();

      let resData;
      const isOk = response.ok;

      // Response'u okumaya çalış
      try {
        // Önce JSON olarak okumayı dene
        resData = await response.json();
      } catch (jsonError) {
        // JSON parse hatası - text olarak oku
        try {
          const text = await responseClone.text();
          try {
            resData = text ? JSON.parse(text) : {};
          } catch (parseError) {
            resData = { message: text || "İşlem başarısız" };
          }
        } catch (textError) {
          // Her iki yöntem de başarısız oldu
          resData = { message: "Response okunamadı" };
        }
      }

      if (!isOk) {
        // Backend'den gelen detaylı hata mesajını kullan
        let errorMsg = resData.message || resData.title || resData.error?.message || "İşlem başarısız";

        // Eğer errors objesi varsa (ASP.NET Core validation errors)
        if (resData.errors && typeof resData.errors === "object") {
          const errorMessages = [];
          for (const key in resData.errors) {
            if (Array.isArray(resData.errors[key])) {
              errorMessages.push(...resData.errors[key]);
            }
          }
          if (errorMessages.length > 0) {
            errorMsg = errorMessages.join(", ");
          }
        }

        const error = new Error(errorMsg);
        error.response = resData;
        throw error;
      }

      return resData;
    } catch (error) {
      // Network hatası veya diğer hatalar
      if (
        error instanceof TypeError &&
        error.message.includes("Failed to fetch")
      ) {
        throw new Error(
          "Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin."
        );
      }
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(error.message || "İşlem başarısız");
      }
    }
  },

  // Genel PUT isteği atan fonksiyon (Veri güncellemek için)
  put: async (endpoint, data) => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      // Response'u text olarak oku (body stream sadece bir kez okunabilir)
      const text = await response.text();
      let resData;

      // Text'i JSON'a parse etmeye çalış
      try {
        resData = text ? JSON.parse(text) : {};
      } catch (e) {
        // JSON değilse text olarak kullan
        resData = { message: text || "İşlem başarısız" };
      }

      if (!response.ok) {
        // Backend'den gelen detaylı hata mesajını kullan
        let errorMsg = resData.title || resData.message || "İşlem başarısız";

        // Eğer errors objesi varsa (ASP.NET Core validation errors)
        if (resData.errors && typeof resData.errors === "object") {
          const errorMessages = [];
          for (const key in resData.errors) {
            if (Array.isArray(resData.errors[key])) {
              errorMessages.push(...resData.errors[key]);
            }
          }
          if (errorMessages.length > 0) {
            errorMsg = errorMessages.join(", ");
          }
        }

        throw new Error(errorMsg);
      }

      return resData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(error.message || "İşlem başarısız");
      }
      }
    },
  
  // FormData ile dosya yükleme (multipart/form-data)
  upload: async (endpoint, formData) => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: "POST",
        body: formData, // FormData kullanıldığında Content-Type header'ı otomatik ayarlanır
      });

      const text = await response.text();
      let resData;

      try {
        resData = text ? JSON.parse(text) : {};
      } catch (e) {
        resData = { message: text || "İşlem başarısız" };
      }

      if (!response.ok) {
        let errorMsg = resData.title || resData.message || "İşlem başarısız";

        if (resData.errors && typeof resData.errors === "object") {
          const errorMessages = [];
          for (const key in resData.errors) {
            if (Array.isArray(resData.errors[key])) {
              errorMessages.push(...resData.errors[key]);
            }
          }
          if (errorMessages.length > 0) {
            errorMsg = errorMessages.join(", ");
          }
        }

        throw new Error(errorMsg);
      }

      return resData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(error.message || "Dosya yükleme başarısız");
      }
    }
  },

  // Genel DELETE isteği atan fonksiyon
  delete: async (endpoint) => {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const text = await response.text();
      let resData;

      try {
        resData = text ? JSON.parse(text) : {};
      } catch (e) {
        resData = { message: text || "İşlem başarılı" };
      }

      if (!response.ok) {
        let errorMsg = resData.title || resData.message || "İşlem başarısız";
        throw new Error(errorMsg);
      }

      return resData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(error.message || "İşlem başarısız");
      }
    }
  },
};
