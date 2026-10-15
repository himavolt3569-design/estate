// Keep the saved values compatible with the shared Android facilities array.
export const FACILITY_GROUPS = [
  {
    label: "Essentials",
    ne: "आधारभूत सुविधा",
    options: [
      { value: "Water", ne: "पानी" },
      { value: "Electricity", ne: "बिजुली" },
      { value: "WiFi", ne: "वाइफाइ" },
      { value: "Parking", ne: "पार्किङ" },
      { value: "Bathroom", ne: "बाथरुम" },
      { value: "Kitchen", ne: "भान्सा" },
    ],
  },
  {
    label: "Comfort & access",
    ne: "आराम र पहुँच",
    options: [
      { value: "Balcony", ne: "बाल्कोनी" },
      { value: "Terrace", ne: "कौसी" },
      { value: "Garden", ne: "बगैँचा" },
      { value: "Lift", ne: "लिफ्ट" },
      { value: "Air conditioning", ne: "एयर कन्डिसनिङ" },
      { value: "Hot water", ne: "तातो पानी" },
      { value: "Laundry", ne: "लुगा धुने सुविधा" },
    ],
  },
  {
    label: "Safety & extras",
    ne: "सुरक्षा र थप सुविधा",
    options: [
      { value: "CCTV", ne: "सीसीटीभी" },
      { value: "Security", ne: "सुरक्षा" },
      { value: "Generator", ne: "जेनेरेटर" },
      { value: "Waste collection", ne: "फोहोर सङ्कलन" },
      { value: "Pets allowed", ne: "पाल्तु जनावर राख्न मिल्ने" },
      { value: "Wheelchair access", ne: "ह्विलचेयर पहुँच" },
    ],
  },
] as const;

export function facilityLabel(value: string, locale: "en" | "ne") {
  const option = FACILITY_GROUPS.flatMap((group) => [...group.options]).find(
    (option) => option.value === value,
  );
  return locale === "ne" ? option?.ne || value : value;
}
