<template>
  <div class="w-full max-w-4xl mx-auto p-4">
    <!-- Location permission button -->
    

    <!-- Search input with loading state -->
    <div class="relative mb-4">
      <input
        v-model="query"
        @input="debouncedAutocomplete"
        placeholder="輸入餐廳名稱"
        class="w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        :disabled="isLoading"
      />
      <div v-if="isLoading" class="absolute right-3 top-3">
        <div class="w-5 h-5 border-2 border-blue-500 rounded-full animate-spin border-t-transparent"></div>
      </div>
      <div v-if="suggestions.length" class="absolute bg-white border rounded-lg shadow-lg w-full mt-2 z-10">
        <ul>
          <li
            v-for="(suggestion, index) in suggestions"
            :key="index"
            class="p-2 hover:bg-gray-100 cursor-pointer"
            @click="selectSuggestion(suggestion)"
          >
            {{ suggestion.description }}
          </li>
        </ul>
      </div>
      
    </div>

    <!-- Error message -->
    <div v-if="error" class="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
      {{ error }}
    </div>

    <!-- Map container -->
    <div id="map" class="w-full h-[600px] rounded-lg shadow-lg"></div>
  </div>
</template>

<script setup>
import { useGoogleMapSearch } from '/src/hooks/useGoogleMapSearch.js';



const { 
        query,
        isLoading,
        error,
        suggestions,
        hasLocation,
        debouncedAutocomplete,
        requestLocation,
        selectSuggestion,
        infowindow
      } = useGoogleMapSearch()


</script>