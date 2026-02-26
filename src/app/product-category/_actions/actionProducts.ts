"use server";

import prisma from "@/lib/prisma"; // your prisma client
import { UserProduct } from "@/app/_context/ProductsProvider";

export const fetchProducts = async (): Promise<UserProduct[]> => {
  const products = await prisma.product.findMany({
    include: {
      category: true,
      images: true,
    },
  });

  return products.map((p) => ({
    ...p,
    inCart: false,
    inWishlist: false,
    quantity: 1,
  }));
};