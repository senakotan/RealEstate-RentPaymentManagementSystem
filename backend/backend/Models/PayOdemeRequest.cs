using System.ComponentModel.DataAnnotations;

namespace EmlakYonetimAPI.Models
{
    public class PayOdemeRequest
    {
        public DateTime? OdemeTarihi { get; set; }
        
        // Tutar hem decimal hem string olarak gelebilir
        public decimal? Tutar { get; set; }
        public string? TutarString { get; set; }
        
        public int? ParaBirimiID { get; set; }
        public int? OdemeYontemID { get; set; }
        public string? Aciklama { get; set; }
    }
}

