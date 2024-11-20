import { ref, onMounted, onUnmounted } from "vue";
import { debounce } from "lodash";


export function useGoogleMapSearch(){

    const query = ref("");
    const map = ref(null);
    const markers = ref([]);
    const places = ref([]);
    const isLoading = ref(false);
    const error = ref("");
    const suggestions = ref([]);
    const hasLocation = ref(false);

    let autocompleteService = null;
    let service = null;
    let currentInfoWindow = null;
    
    // 生成評分星星的HTML
    function generateStarRating(rating) {
      const stars = [];
      for (let i = 1; i <= 5; i++) {
        const starClass = i <= Math.round(rating || 0) ? 'text-yellow-400' : 'text-gray-300';
        stars.push(`
          <svg class="w-4 h-4 ${starClass} fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        `);
      }
      return stars.join('');
    }
    
    function createInfoWindowContent(place) {
      return `
        <div class="max-w-sm bg-white rounded-lg overflow-hidden">
          <div class="flex gap-4 p-4">
            <div class="w-24 h-20 rounded-lg overflow-hidden flex-shrink-0">
              <img 
                src="${place.photos?.[0]?.getUrl() || '/api/placeholder/96/96'}" 
                alt="${place.name}"
                class="w-full h-full object-cover"
              />
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h3 class="font-medium text-lg">${place.name}</h3>
                <div class="flex items-center">
                  <div class="flex text-yellow-400">${generateStarRating(place.rating)}</div>
                  <span class="ml-1 text-sm text-gray-600">${place.rating ? `${place.rating.toFixed(1)} (${place.user_ratings_total})` : '暫無評分'}</span>
                </div>
              </div>
              <p class="text-sm text-gray-600 mt-1">${place.formatted_address}</p>
              <div class="mt-2 flex gap-4 text-sm text-gray-500">
                <span>${place.opening_hours?.isOpen() ? '營業中' : '已打烊'}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    const debouncedAutocomplete = debounce(() => {
      fetchSuggestions(query.value);
    }, 300);
    
    // 載入 Google Maps 腳本
    function loadGoogleMapsScript(apiKey) {
        return new Promise((resolve, reject) => {
            if (window.google?.maps) {
                resolve();
                return;
            }

            const script = document.createElement("script");
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&callback=initMap`;
            script.async = true;
            document.head.appendChild(script);

            window.initMap = () => {
                resolve();
            };

            script.onerror = () => reject(new Error("Google Maps 載入失敗"));
        });
    }
    
    // 初始化地圖
    async function initializeMap(location) {
        const mapElement = document.getElementById("map");
        if (!mapElement) throw new Error("Map container not found");

        map.value = new google.maps.Map(mapElement, {
            center: location,
            zoom: 13,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
        });

        service = new google.maps.places.PlacesService(map.value);
        autocompleteService = new google.maps.places.AutocompleteService();
    }
    
    // 請求並獲取位置
    async function requestLocation() {
        try {
            const position = await getCurrentPosition();
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            hasLocation.value = true;
            return userLocation;
        } catch (err) {
            console.error("Geolocation error:", err);
            error.value = "無法獲取位置信息，使用預設位置";
            // 預設位置（台北）
            return { lat: 25.033, lng: 121.565 };
        }
    }
    
     // 獲取當前位置
     function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("瀏覽器不支持地理位置"));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });
    }
    
    // 組件掛載時的初始化流程
    onMounted(async () => {
        try {
            // 1. 首先載入 Google Maps 腳本
            await loadGoogleMapsScript(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
            
            // 2. 獲取位置（實際位置或預設位置）
            const location = await requestLocation();
            
            // 3. 使用獲取到的位置初始化地圖
            await initializeMap(location);
        } catch (err) {
            handleError(err);
        }

        document.addEventListener("click", handleClickOutside);
    });
    
    onUnmounted(() => {
      clearMarkers();
      document.removeEventListener("click", handleClickOutside);
    });
    
    async function fetchSuggestions(input) {
      if (!input.trim()) {
        suggestions.value = [];
        return;
      }
    
      isLoading.value = true;
      try {
        const result = await new Promise((resolve, reject) => {
          autocompleteService.getPlacePredictions(
            { input, types: ["establishment"] },
            (predictions, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK) {
                resolve(predictions || []);
              } else {
                reject(new Error("搜尋建議獲取失敗"));
              }
            }
          );
        });
        suggestions.value = result;
      } catch (err) {
        error.value = err.message;
        suggestions.value = [];
      } finally {
        isLoading.value = false;
      }
    }
    
    function selectSuggestion(suggestion) {
      query.value = suggestion.description;
      suggestions.value = [];
      searchPlaceById(suggestion.place_id);
    }
    
    function searchPlaceById(placeId) {
      const request = {
        placeId,
        fields: [
          'name',
          'geometry',
          'formatted_address',
          'photos',
          'rating',
          'user_ratings_total',
          'opening_hours',
          'price_level'
        ]
      };
      
      service.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place.geometry) {
          clearMarkers();
          
          // 創建新的標記
          const marker = new google.maps.Marker({
            map: map.value,
            position: place.geometry.location,
            title: place.name,
            animation: google.maps.Animation.DROP
          });
    
          // 如果有現有的 InfoWindow，先關閉它
          if (currentInfoWindow) {
            currentInfoWindow.close();
          }
    
          // 創建新的 InfoWindow
          const infoWindow = new google.maps.InfoWindow({
            content: createInfoWindowContent(place),
            maxWidth: 450
          });
    
          // 為標記添加點擊事件
          marker.addListener('click', () => {
            if (currentInfoWindow) {
              currentInfoWindow.close();
            }
            infoWindow.open(map.value, marker);
            currentInfoWindow = infoWindow;
          });
    
          // 保存標記和地點信息
          markers.value.push(marker);
          places.value = [place];
    
          // 移動地圖到標記位置並打開信息窗口
          map.value.setCenter(place.geometry.location);
          map.value.setZoom(16);
          infoWindow.open(map.value, marker);
          currentInfoWindow = infoWindow;
        } else {
          error.value = "無法定位到該地點，請選擇其他建議。";
        }
      });
    }
    
    function handleClickOutside(event) {
      const inputElement = document.querySelector("input");
      if (!inputElement.contains(event.target)) {
        suggestions.value = [];
      }
    }
    
    function clearMarkers() {
      markers.value.forEach((marker) => marker.setMap(null));
      markers.value = [];
      if (currentInfoWindow) {
        currentInfoWindow.close();
        currentInfoWindow = null;
      }
    }
    
    function handleError(err) {
      error.value = "地圖載入失敗，請檢查網絡連接或重新整理頁面";
      console.error(err);
    }


    return {
        // Reactive references
        query,
        map,
        markers,
        places,
        isLoading,
        error,
        suggestions,
        hasLocation,
        
        // Methods
        debouncedAutocomplete,
        requestLocation,
        selectSuggestion,
        searchPlaceById,
        clearMarkers,
        handleError,
        handleClickOutside,
        fetchSuggestions
    }

}    