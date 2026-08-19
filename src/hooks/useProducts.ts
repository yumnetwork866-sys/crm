import { useCallback, useEffect, useState } from 'react';
import { INITIAL_PRODUCT_LIST } from '../data/mockData';
import type { AppUser, Product } from '../types';
import { api } from '../utils/apiClient';

const STORAGE_KEY_PRODUCTS = 'yumcrm_products_v2';

const loadProducts = (): Product[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_PRODUCTS);
    return saved ? JSON.parse(saved) : INITIAL_PRODUCT_LIST;
  } catch {
    return INITIAL_PRODUCT_LIST;
  }
};

export function useProducts(currentUser: AppUser | null) {
  const [products, setProducts] = useState<Product[]>(loadProducts);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
    } catch (error) {
      console.error('Error saving products to localStorage', error);
    }
  }, [products]);

  useEffect(() => {
    if (!currentUser) return;
    api.get<Product[]>('/products')
      .then((response) => {
        if (Array.isArray(response)) setProducts(response);
      })
      .catch(() => null);
  }, [currentUser]);

  const addProduct = useCallback(async (newProduct: Partial<Product>) => {
    let savedProduct: Product | null = null;
    try {
      savedProduct = await api.post<Product>('/products', newProduct);
    } catch (error) {
      console.error('API error adding product, falling back to local:', error);
    }

    const product: Product = savedProduct || {
      id: newProduct.id || `prd_${Date.now()}`,
      code: newProduct.code || `SP-${Math.floor(100 + Math.random() * 900)}`,
      name: newProduct.name || '',
      category: newProduct.category || 'Mỹ Phẩm',
      price: newProduct.price || 0,
      costPrice: newProduct.costPrice || 0,
      stock: newProduct.stock ?? 50,
      status: newProduct.status || 'In Stock',
      sku: newProduct.sku || '',
      description: newProduct.description || '',
      image: newProduct.image || '',
    };
    setProducts((previous) => [product, ...previous]);
  }, []);

  const editProduct = useCallback(async (updatedProduct: Product) => {
    let savedProduct: Product | null = null;
    try {
      savedProduct = await api.put<Product>(`/products/${updatedProduct.id}`, updatedProduct);
    } catch (error) {
      console.error('API error updating product, falling back to local:', error);
    }
    setProducts((previous) =>
      previous.map((product) =>
        product.id === updatedProduct.id ? savedProduct || updatedProduct : product
      )
    );
  }, []);

  const deleteProduct = useCallback(async (productId: string) => {
    try {
      await api.delete(`/products/${productId}`);
    } catch (error) {
      console.error('API error deleting product, falling back to local:', error);
    }
    setProducts((previous) => previous.filter((product) => product.id !== productId));
  }, []);

  const importProducts = useCallback((newProducts: Product[]) => {
    setProducts((previous) => [...newProducts, ...previous]);
  }, []);

  const resetProducts = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_PRODUCTS);
    setProducts(INITIAL_PRODUCT_LIST);
  }, []);

  return {
    products,
    setProducts,
    addProduct,
    editProduct,
    deleteProduct,
    importProducts,
    resetProducts,
  };
}
