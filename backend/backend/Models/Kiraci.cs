namespace EmlakYonetimAPI.Models
{
    public class Kiraci
    {
        public int KiraciID { get; set; }
        public int KullaniciID { get; set; }
        public bool AktifMi { get; set; }
    }


    public class KiraciDetayDto
    {
        public int KiraciID { get; set; }
        public int KullaniciID { get; set; }
        public string AdSoyad { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Telefon { get; set; }
        public string? TCNo { get; set; }
        public bool AktifMi { get; set; }
    }
}
