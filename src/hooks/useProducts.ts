import { useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { INITIAL_PRODUCT_LIST } from '../data/mockData';
import type { AppUser, Product } from '../types';
import { queryKeys } from '../lib/queryClient';
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

const createLocalProduct = (input: Partial<Product>): Product => ({
  id: input.id || `prd_${Date.now()}`,
  code: input.code || `SP-${Math.floor(100 + Math.random() * 900)}`,
  name: input.name || '',
  category: input.category || 'Mỹ Phẩm',
  price: input.price || 0,
  costPrice: input.costPrice || 0,
  stock: input.stock ?? 50,
  status: input.status || 'In Stock',
  sku: input.sku || '',
  description: input.description || '',
  image: input.image || '',
});

export function useProducts(currentUser: AppUser | null) {
  const queryClient = useQueryClient();
  const productsQuery = useQuery({
    queryKey: queryKeys.products,
    queryFn: () => api.get<Product[]>('/products'),
    enabled: Boolean(currentUser),
    initialData: loadProducts,
    initialDataUpdatedAt: 0,
  });
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(products));
    } catch (error) {
      console.error('Error saving products to localStorage', error);
    }
  }, [products]);

  const addMutation = useMutation({
    mutationFn: (input: Partial<Product>) => api.post<Product>('/products', input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products });
      const previous = queryClient.getQueryData<Product[]>(queryKeys.products) || [];
      const optimistic = createLocalProduct(input);
      queryClient.setQueryData<Product[]>(queryKeys.products, [optimistic, ...previous]);
      return { previous, optimisticId: optimistic.id };
    },
    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData(queryKeys.products, context.previous);
    },
    onSuccess: (saved, _input, context) => {
      queryClient.setQueryData<Product[]>(queryKeys.products, (current = []) =>
        current.map((product) => product.id === context?.optimisticId ? saved : product)
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
  });

  const editMutation = useMutation({
    mutationFn: (product: Product) => api.put<Product>(`/products/${product.id}`, product),
    onMutate: async (product) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products });
      const previous = queryClient.getQueryData<Product[]>(queryKeys.products) || [];
      queryClient.setQueryData<Product[]>(queryKeys.products, (current = []) =>
        current.map((item) => item.id === product.id ? product : item)
      );
      return { previous };
    },
    onError: (_error, _product, context) => {
      if (context) queryClient.setQueryData(queryKeys.products, context.previous);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<Product[]>(queryKeys.products, (current = []) =>
        current.map((product) => product.id === saved.id ? saved : product)
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: string) => api.delete(`/products/${productId}`),
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products });
      const previous = queryClient.getQueryData<Product[]>(queryKeys.products) || [];
      queryClient.setQueryData<Product[]>(queryKeys.products, (current = []) =>
        current.filter((product) => product.id !== productId)
      );
      return { previous };
    },
    onError: (_error, _productId, context) => {
      if (context) queryClient.setQueryData(queryKeys.products, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.products }),
  });

  const importMutation = useMutation({
    mutationFn: async (newProducts: Product[]) => newProducts,
    onMutate: async (newProducts) => {
      const previous = queryClient.getQueryData<Product[]>(queryKeys.products) || [];
      queryClient.setQueryData<Product[]>(queryKeys.products, [...newProducts, ...previous]);
      return { previous };
    },
    onError: (_error, _products, context) => {
      if (context) queryClient.setQueryData(queryKeys.products, context.previous);
    },
  });

  const addProduct = useCallback(async (input: Partial<Product>) => {
    await addMutation.mutateAsync(input).catch((error) => console.error('Error adding product:', error));
  }, [addMutation]);
  const editProduct = useCallback(async (product: Product) => {
    await editMutation.mutateAsync(product).catch((error) => console.error('Error updating product:', error));
  }, [editMutation]);
  const deleteProduct = useCallback(async (productId: string) => {
    await deleteMutation.mutateAsync(productId).catch((error) => console.error('Error deleting product:', error));
  }, [deleteMutation]);
  const importProducts = useCallback((newProducts: Product[]) => {
    importMutation.mutate(newProducts);
  }, [importMutation]);
  const resetProducts = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_PRODUCTS);
    queryClient.setQueryData(queryKeys.products, INITIAL_PRODUCT_LIST);
  }, [queryClient]);

  const mutationError = addMutation.error || editMutation.error || deleteMutation.error || importMutation.error;
  return {
    products,
    addProduct,
    editProduct,
    deleteProduct,
    importProducts,
    resetProducts,
    isLoading: productsQuery.isLoading,
    isFetching: productsQuery.isFetching,
    isError: productsQuery.isError || Boolean(mutationError),
    error: productsQuery.error || mutationError,
    isMutating: addMutation.isPending || editMutation.isPending || deleteMutation.isPending || importMutation.isPending,
  };
}
