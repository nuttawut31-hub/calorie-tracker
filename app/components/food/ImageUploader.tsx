'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, Sparkles, ImageIcon, Loader2 } from 'lucide-react';
import Card from '@/app/components/ui/Card';
import { useTrackerStore } from '@/lib/store';
import type { Ingredient } from '@/lib/types';
import { generateId } from '@/lib/utils';

/**
 * Drag-and-drop image uploader with AI food analysis.
 * Sends image to /api/analyze-image which returns full nutrition data
 * (ingredients + grams + all 7 nutrients) in a single OpenAI call.
 */
export default function ImageUploader() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { setIngredients } = useTrackerStore();

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError('Image must be under 4MB.');
      return;
    }

    setError(null);
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  async function handleAnalyze() {
    if (!imageFile) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      // Single API call: analyze image → get ingredients WITH full nutrition
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await fetch('/api/analyze-image', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze image');
      }

      if (!data.ingredients || data.ingredients.length === 0) {
        setError('No food items detected. Try a clearer image with visible food.');
        return;
      }

      // Set ingredients directly — API now returns full Ingredient[] with nutrition
      setIngredients(data.ingredients);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An unexpected error occurred'
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  // Demo mode: mock ingredients for testing without API key
  function handleDemoAnalyze() {
    const mockIngredients: Ingredient[] = [
      {
        id: generateId(),
        name: 'Grilled Chicken Breast',
        grams: 150,
        nutrition: {
          calories: 248,
          protein: 46.5,
          fat: 5.4,
          carbs: 0,
          fiber: 0,
          sugar: 0,
          sodium: 104,
        },
      },
      {
        id: generateId(),
        name: 'Steamed Brown Rice',
        grams: 200,
        nutrition: {
          calories: 248,
          protein: 5.5,
          fat: 2.0,
          carbs: 51.7,
          fiber: 3.2,
          sugar: 0.7,
          sodium: 6,
        },
      },
      {
        id: generateId(),
        name: 'Steamed Broccoli',
        grams: 100,
        nutrition: {
          calories: 35,
          protein: 2.4,
          fat: 0.4,
          carbs: 7.2,
          fiber: 3.3,
          sugar: 1.4,
          sodium: 41,
        },
      },
    ];

    setIngredients(mockIngredients);
  }

  return (
    <Card id="image-uploader" hover>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="section-title">AI Food Scanner</h2>
          <p className="section-subtitle">
            Upload a food photo for instant analysis
          </p>
        </div>
      </div>

      {/* Drop Zone / Preview */}
      {!imagePreview ? (
        <div
          className={`dropzone ${isDragging ? 'dropzone-active' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              fileInputRef.current?.click();
            }
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center">
              <Upload className="w-7 h-7 text-white/30" />
            </div>
            <div>
              <p className="text-sm font-medium text-white/60 mb-1">
                Drop your food image here
              </p>
              <p className="text-xs text-white/30">
                or click to browse • JPEG, PNG, WebP • Max 4MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden animate-fade-in">
          {/* Image Preview */}
          <img
            src={imagePreview}
            alt="Food preview"
            className="w-full h-48 object-cover rounded-xl"
          />

          {/* Remove Button */}
          <button
            onClick={clearImage}
            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 
                       flex items-center justify-center text-white/80 
                       hover:bg-black/80 transition-colors"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Analyzing Overlay */}
          {isAnalyzing && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                <p className="text-sm font-medium text-white/80">
                  Analyzing your food...
                </p>
                <p className="text-xs text-white/40">
                  AI is identifying ingredients & calculating nutrition
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger animate-slide-down">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      {imagePreview && !isAnalyzing && (
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleAnalyze}
            id="analyze-food-button"
            className="btn-primary flex-1"
          >
            <Sparkles className="w-4 h-4" />
            Analyze with AI
          </button>
        </div>
      )}

      {/* Demo Button when no image */}
      {!imagePreview && (
        <div className="mt-3">
          <button
            onClick={handleDemoAnalyze}
            className="btn-secondary w-full text-sm"
          >
            <ImageIcon className="w-4 h-4" />
            Try with Demo Data (no image needed)
          </button>
        </div>
      )}
    </Card>
  );
}
