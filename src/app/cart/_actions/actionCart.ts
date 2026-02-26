"use server";

import getUser from "@/app/_components/getUser";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// ======================== Add to cart ========================

/**
 * add product to specific user who login
 * @param prodId -  product id param
 * @throws Error if the operation fails
 */
export const actionAddToCart = async (prodId: string) => {
  try {
    const user = await getUser();
    if (!user) throw new Error("User not found");

    const product = await prisma.product.findUnique({
      where: { id: prodId },
    });

    if (!product) throw new Error("Product not found");

    // Fetch user with cart
    let userWithCart = await prisma.user.findUnique({
      where: { id: user.id },
      include: { Cart: { include: { items: true } } },
    });

    if (!userWithCart) throw new Error("User not found");

    // Create cart if it doesn't exist
    if (!userWithCart.Cart) {
      userWithCart = await prisma.user.update({
        where: { id: user.id },
        data: {
          Cart: { create: {} },
        },
        include: { Cart: { include: { items: true } } },
      });
    }

    const cart = userWithCart.Cart;
    if (!cart) throw new Error("Cart not found");

    const existingCartItem = cart.items.find((item) => item.productId === prodId);

    const itemPrice = product.offer ?? product.price;

    if (existingCartItem) {
      // Update existing item
      await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: {
          quantity: existingCartItem.quantity + 1,
          totalPrice: existingCartItem.totalPrice + itemPrice,
        },
      });
    } else {
      // Add new item
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: product.id,
          quantity: 1,
          totalPrice: itemPrice,
        },
      });
    }

    // Revalidate homepage (or cart page) after update
    revalidatePath("/");

    return { success: true };
  } catch (err) {
    console.error("Add to cart error:", err);
    const message = err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Delete fom cart ========================

/**
 * delete product to specific user who login
 * @param prodId -  product id param
 * @throws Error if the operation fails
 */
export const actionDeleteFromCart = async (prodId: string) => {
  try {
    const user = await getUser();
    if (!user) return;

    const userWithCart = await prisma.user
      .findUnique({
        where: { id: user.id },
        include: { Cart: { include: { items: true } } },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!userWithCart || !userWithCart.Cart) throw new Error("Cart not found");

    const cartItem = userWithCart.Cart.items.find(
      (item) => item.productId === prodId
    );

    if (!cartItem) throw new Error("Item not found in cart");

    // Update cart total

    await prisma.cartItem
      .delete({
        where: { id: cartItem.id },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    revalidatePath("/cart");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Get Cart  ========================

/**
 * get Car exist products to specific user who login
 * @throws Error if the operation fails
 */
export const actionGetCartUser = async () => {
  try {
    const user = await getUser();

    if (!user?.id) return;

    const cart = await prisma.cart
      .findUnique({
        where: { userId: user?.id },
        include: {
          items: {
            include: { product: true },
            orderBy: { product: { name: "desc" } },
          },
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!cart) return [];

    return cart;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

export const actionIncrementQu = async (prodId: string, quantity: number) => {
  try {
    const user = await getUser();
    if (!user) throw new Error("Must be logged in to modify cart");

    const userWithCart = await prisma.user
      .findUnique({
        where: { id: user.id },
        include: { Cart: { include: { items: true } } },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!userWithCart || !userWithCart.Cart) throw new Error("Cart not found");

    const cartItem = userWithCart.Cart.items.find(
      (item) => item.productId === prodId
    );

    if (!cartItem) throw new Error("Item not found in cart");

    const product = await prisma.product
      .findUnique({
        where: { id: prodId },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!product) throw new Error("Product not found");

    const itemPrice = product.offer ? product.offer : product.price;

    await prisma.cartItem
      .update({
        where: { id: cartItem.id },
        data: {
          quantity: quantity,
          totalPrice: quantity * itemPrice,
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    // Update cart total

    revalidatePath("/");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

export const actionDecrementQu = async (prodId: string, quantity: number) => {
  try {
    if (quantity <= 0) return { success: true };
    const user = await getUser();
    if (!user) throw new Error("Must be logged in to modify cart");

    const userWithCart = await prisma.user
      .findUnique({
        where: { id: user.id },
        include: { Cart: { include: { items: true } } },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!userWithCart || !userWithCart.Cart) throw new Error("Cart not found");

    const cartItem = userWithCart.Cart.items.find(
      (item) => item.productId === prodId
    );

    if (cartItem?.quantity === 1) {
      throw new Error("Can't decrement quantity to minus");
    }
    if (!cartItem) throw new Error("Item not found in cart");

    const product = await prisma.product
      .findUnique({
        where: { id: prodId },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!product) throw new Error("Product not found");

    const itemPrice = product.offer ? product.offer : product.price;

    await prisma.cartItem
      .update({
        where: { id: cartItem.id },
        data: {
          quantity: quantity,
          totalPrice: quantity * itemPrice,
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    revalidatePath("/");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message, success: false };
  }
};

export const actionRemoveAllInCart = async () => {
  try {
    const user = await getUser();
    if (!user) return;

    const userWithCart = await prisma.user
      .findUnique({
        where: { id: user.id },
        include: { Cart: { include: { items: true } } },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!userWithCart || !userWithCart.Cart) {
      throw new Error("Cart not found");
    }

    // Delete all cart items
    await prisma.cartItem
      .deleteMany({
        where: { cartId: userWithCart.Cart.id },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    revalidatePath("/cart");
    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Proggress Shippong ========================

/**
 *  proggress for shipping when if it complete total amount in cart or more get free shipping
 * @throws Error if the operation fails
 */
export const actionGetProgressShapping = async () => {
  try {
    const user = await getUser();
    if (!user) throw new Error("user not found");

    const userWithCart = await prisma.cart
      .findUnique({
        where: { userId: user.id },
        include: { items: { include: { product: true } } },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    const shipping = await prisma.shipping.findMany().catch((err) => {
      throw new Error("Server not responding");
    });
    const shipping_rate = shipping[0]?.shipping ?? 100;

    if (!userWithCart) {
      return {
        precentage: 0,
        shipping: shipping_rate,
        left_precentage: 100,
        left_money: shipping_rate,
        compelete: false,
      };
    }

    let totalAmount = 0;
    userWithCart.items.forEach((item) => {
      totalAmount += item.totalPrice || 0;
    });

    // Calculate values ensuring they don't go negative
    const left_money = Math.max(shipping_rate - totalAmount, 0);
    const left_precentage = (left_money / shipping_rate) * 100;
    const precentage = 100 - left_precentage;
    const compelete = totalAmount >= shipping_rate;

    return {
      precentage: Math.min(precentage, 100), // Cap at 100%
      shipping: shipping_rate,
      left_precentage,
      left_money,
      compelete,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "something went wrong!";
    return { errMsg: message };
  }
};
