// config.js

// 1) point the template at your 1 000-point sample instead of the full layer:
window.LANDMARKS_SERVICE_URL = 
  "https://services-eu1.arcgis.com/FckSU1kja7wbnBnq/arcgis/rest/services/Landmarks_1000/FeatureServer/0";

// 2) keep your proxy pointing at your Flask endpoint:
window.LANDMARKS_PROXY_URL   = "https://api.jewishatlas.org/api/landmarks";
