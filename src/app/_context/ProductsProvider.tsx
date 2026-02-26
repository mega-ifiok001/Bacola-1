"use client";

import { Product } from "@prisma/client";

import React, {
  createContext,
  ReactNode,
  SetStateAction,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useUser } from "./UserProvider";

export interface UserProduct extends Product {
  _count: { ratings: number };
  _sum?: any;
  category: Category;
  images: any;
  inCart: boolean;
  inWishlist: boolean;
  quantity: number;
  best?: boolean;
  newest?: boolean;
  best_newest?: boolean;
}

export interface FilterType {
  currentPage: number;
  totalPages: number;
  totalProducts: number;
}

type contextType = {
  products: UserProduct[];
  filter: FilterType;
  setProducts: React.Dispatch<SetStateAction<UserProduct[]>>;
  setProductsNewest: React.Dispatch<SetStateAction<UserProduct[]>>;
  setProductsBest: React.Dispatch<SetStateAction<UserProduct[]>>;
  productsBest: UserProduct[];
  productsNewest: UserProduct[];
  setFilter: React.Dispatch<SetStateAction<FilterType>>;
  updateQuantity: (productId: string, newQuantity: number) => void;
  updateInCart: (productId: string, inCart: boolean) => void;
  updateInWishlist: (productId: string, inWishlist: boolean) => void;
  getBestSeller: () => UserProduct[];
  getNewest: () => UserProduct[];
};

const productsContext = createContext<contextType>({
  products: [],
  filter: {
    currentPage: 0,
    totalPages: 0,
    totalProducts: 0,
  },
  setProducts: () => {},
  updateQuantity: () => {},
  setFilter: () => {},
  updateInCart: () => {},
  updateInWishlist: () => {},
  getBestSeller: () => [],
  getNewest: () => [],
  setProductsNewest: () => {},
  setProductsBest: () => {},
  productsBest: [],
  productsNewest: [],
});

function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<UserProduct[]>([]);
  const [productsBest, setProductsBest] = useState<UserProduct[]>([]);
  const [productsNewest, setProductsNewest] = useState<UserProduct[]>([]);

  const [filter, setFilter] = useState<FilterType>({
    currentPage: 0,
    totalPages: 0,
    totalProducts: 0,
  });

  useEffect(() => {
    const setDefaultProducts = () => {
      if (productsBest.length && productsNewest.length) {
        const duplicatesProducts = productsBest.filter((productBest) =>
          productsNewest.map(
            (productNewest) => productBest.id === productNewest.id
          )
        );

        const bestNewestProducts = duplicatesProducts.map((product) => ({
          ...product,
          best_newest: true,
        }));

        const removeDuplicatesProducts = [
          ...productsBest,
          ...productsNewest,
        ].filter(
          (product, index, self) =>
            index === self.findIndex((p) => p.id === product.id)
        );

        return setProducts([
          ...removeDuplicatesProducts,
          ...bestNewestProducts,
        ]);
      }
    };
    setDefaultProducts();
  }, [productsBest.length, productsNewest.length]);

  const updateQuantity = useCallback(
    (productId: string, newQuantity: number) => {
      setProducts((prevProducts) =>
        prevProducts.map((product) =>
          product.id === productId
            ? { ...product, quantity: newQuantity }
            : product
        )
      );
    },
    []
  );

  const updateInCart = useCallback((productId: string, inCart: boolean) => {
    setProducts((prevProducts) =>
      prevProducts.map((product) =>
        product.id === productId ? { ...product, inCart: inCart } : product
      )
    );
  }, []);

  const updateInWishlist = useCallback(
    (productId: string, inWishlist: boolean) => {
      setProducts((prevProducts) =>
        prevProducts.map((product) =>
          product.id === productId
            ? { ...product, inWishlist: inWishlist }
            : product
        )
      );
    },
    []
  );

  const getBestSeller = (): UserProduct[] => {
    const newestProductIds = new Set(productsNewest.map((p) => p.best_newest));

    const productsFound = products.filter(
      (product) =>
        productsBest.some((b) => b.id === product.id) &&
        newestProductIds.has(product.best_newest)
    );

    return productsFound.length ? productsFound : productsBest;
  };

  const getNewest = (): UserProduct[] => {
    const bestProductIds = new Set(productsBest.map((p) => p.best_newest));
    const productsFound = products.filter(
      (product) =>
        productsNewest.some((n) => n.id === product.id) &&
        bestProductIds.has(product.best_newest)
    );

    return productsFound.length ? productsFound : productsNewest;
  };

  return (
    <productsContext.Provider
      value={{
        getNewest,
        products,
        setProducts,
        updateQuantity,
        filter,
        setFilter,
        updateInCart,
        updateInWishlist,
        getBestSeller,
        productsBest,
        productsNewest,
        setProductsBest,
        setProductsNewest,
      }}
    >
      {children}
    </productsContext.Provider>
  );
}

export const useProduct = () => {
  return useContext(productsContext);
};

export default ProductsProvider;
    