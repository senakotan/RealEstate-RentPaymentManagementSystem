using System.ComponentModel.DataAnnotations;

namespace EmlakYonetimAPI.Models
{
    public class RegisterRequest
    {
        [Required(ErrorMessage = "Ad Soyad zorunludur.")]
        public string AdSoyad { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email adresi zorunludur.")]
        [EmailAddress(ErrorMessage = "Geçerli bir email adresi giriniz.")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Şifre zorunludur.")]
        [MinLength(6, ErrorMessage = "Şifre en az 6 karakter olmalıdır.")]
        public string Sifre { get; set; } = string.Empty;

        public string? Telefon { get; set; }
        public string? TCNo { get; set; }

        // Rol seçimi (Owner veya Tenant, varsayılan: Owner)
        public string? RolAdi { get; set; }
    }
}

