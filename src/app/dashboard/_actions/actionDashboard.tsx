"use server";

import prisma from "@/lib/prisma";
import getSupervisor from "../_components/getSupervisor";
import { sendNewManagerAdd, sendReplaceEmail } from "@/mailtrap/emails";
import { revalidatePath } from "next/cache";
import { nameCheck, pagination, passwordCheck } from "@/lib/utils";
import cloudinary from "@/lib/cloudinary";
import getUser from "@/app/_components/getUser";
import bcrypt from "bcryptjs";
import { OrderStatus, Prisma } from "@prisma/client";
import { startOfDay, subDays } from "date-fns";

// ======================== Email Replacement ========================

/**
 * Replaces the email of the current supervisor (admin or manager) and sends a confirmation email.
 * @param email - New email address
 * @throws Error if the operation fails
 */
export const actionReplaceEmail = async (email: string) => {
  try {
    const supervisor = await getSupervisor();

    // Check if the supervisor is an admin or manager
    const admin = await prisma.admin
      .findFirst({
        where: { id: supervisor.id || "" },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });
    const manager = await prisma.manager
      .findFirst({
        where: { id: supervisor.id || "" },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });
    if (!admin && !manager) throw new Error("Forbidden");

    // Check if the new email already exists
    const findCEmail = await prisma.manager
      .findUnique({
        where: { email: email.toLowerCase() },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });
    if (findCEmail) throw new Error("Email already exists");

    // Send confirmation email
    try {
      await sendReplaceEmail(email);
    } catch (err) {
      throw new Error("Invalid email or error sending email");
    }

    // Update email in the database
    if (admin) {
      await prisma.admin
        .update({
          where: { id: supervisor.id || "" },
          data: { email: email },
        })
        .catch(() => {
          throw new Error("Server not responding");
        });
    }
    if (manager) {
      await prisma.manager
        .update({
          where: { id: supervisor.id || "" },
          data: { email: email },
        })
        .catch(() => {
          throw new Error("Server not responding");
        });
    }

    revalidatePath("/dashboard");
    return;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Manager Management ========================

/**
 * Adds a new manager and sends a welcome email.
 * @param email - New manager's email address
 * @throws Error if the operation fails
 */
export const actionAddManager = async (email: string) => {
  try {
    const supervisor = await getSupervisor();

    // Only admins can add managers
    if (supervisor.role !== "admin") throw new Error("Forbidden");

    // Check if the email already exists
    const findCEmail = await prisma.manager
      .findUnique({
        where: { email: email.toLowerCase() },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });
    if (findCEmail) throw new Error("Email already exists");

    // Send welcome email
    try {
      await sendNewManagerAdd(supervisor.email || "", email);
    } catch (err) {
      throw new Error("Invalid email or error sending email");
    }

    // Create the new manager
    const newManager = await prisma.manager
      .create({
        data: { email: email },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    revalidatePath("/dashboard/settings");
    return newManager;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

/**
 * Deletes a manager by email.
 * @param email - Manager's email address
 * @throws Error if the operation fails
 */
export const actionDeleteManager = async (email: string) => {
  try {
    const supervisor = await getSupervisor();

    if (supervisor.role !== "admin") throw new Error("Forbbiden");

    await prisma.manager.delete({ where: { email } }).catch(() => {
      throw new Error("Server not responding");
    });

    revalidatePath("/dashboard/settings", "page");
    return;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Pagination for Managers ========================

let pageManager: number = 1;

/**
 * Returns the current page number for managers.
 */
export const getPageManagers = async () => {
  return pageManager;
};

/**
 * Increments the page number for managers and revalidates the path.
 */
export const actionPageNextManagers = async () => {
  revalidatePath("/dashboard/settings");
  return ++pageManager;
};

/**
 * Decrements the page number for managers and revalidates the path.
 */
export const actionPagePrevManagers = async () => {
  revalidatePath("/dashboard/settings");
  return --pageManager;
};

/**
 * Fetches managers with pagination.
 * @param page - Current page number
 * @throws Error if the operation fails
 */
export const actionGetManagers = async (page: number) => {
  try {
    const supervisor = await getSupervisor();

    if (supervisor?.role !== "admin") throw new Error("Forbbiden");

    if (page <= 0) page = 1;

    const findManagers = await prisma.manager
      .findMany({
        orderBy: { createdAt: "desc" },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    const { currentPage, pages, no } = pagination(findManagers, page);

    return {
      currentPage,
      pages,
      no,
      count: findManagers.length,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Category Management ========================

/**
 * Creates a new category.
 * @param category - Category name
 * @throws Error if the operation fails
 */
export const actionCreatCategory = async (category: string, image: string) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    const findCategory = await prisma.category
      .findUnique({
        where: { name: category.toLowerCase().trim() },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    if (findCategory) throw new Error("Category already exists");

    const cloudinaryResponse = await cloudinary.uploader
      .upload(image, {
        folder: "products",
      })
      .catch((err) => {
        console.log(err);
        throw new Error("Server not responding to upload image");
      });

    await prisma.category
      .create({
        data: {
          name: category.toLowerCase().trim(),
          image: cloudinaryResponse?.secure_url,
        },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    revalidatePath("/dashboard");
    return;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

/**
 * Deletes a category by ID.
 * @param id - Category ID
 * @throws Error if the operation fails
 */
export const actionDeleteCategory = async (id: string) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    await prisma.category.delete({ where: { id } }).catch((err) => {
      throw new Error(err);
    });

    revalidatePath("/dashboard");
    return;
  } catch (err) {
    console.log(err);
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

/**
 * Fetches all categories.
 * @throws Error if the operation fails
 */
export const actionGetCategories = async () => {
  try {
    const categories = await prisma.category.findMany().catch(() => {
      console.error("Server not responding");
      return []; // Return empty array if DB fails
    });

    return categories || []; // Always ensure an array
  } catch (err) {
    console.error("Something went wrong fetching categories:", err);
    return []; // Return empty array on any errorƒp
  }
};
export const actionGetCategoryName = async (name: string) => {
  try {
    const category = await prisma.category
      .findUnique({ where: { name }, select: { name: true, id: true } })
      .catch(() => {
        throw new Error("Server not responding");
      });

    return category;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Product Management ========================

/**
 * Creates a new product.
 * @param data - Product data including name, description, images, price, etc.
 * @throws Error if the operation fails
 */
export const actionCreateProduct = async (data: {
  name: string;
  description: string;
  images: { type: string; image: string; file: File }[];
  price: number;
  isFeatured: boolean;
  offer: number;
  category: string;
  sizes: string;
  type?: string;
}) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    const {
      category,
      description,
      images,
      isFeatured,
      name,
      offer,
      price,
      sizes,
      type,
    } = data;

    // Validate required fields
    if (
      !category ||
      !description ||
      !name ||
      !price ||
      !images.length ||
      !sizes
    )
      throw new Error("All required fields must be filled");

    // Check if the category exists
    const findCategory = await prisma.category
      .findUnique({
        where: { name: category.toLowerCase().trim() },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });
    if (!findCategory) throw new Error("Invalid category");

    // Check if the product already exists
    const findProduct = await prisma.product
      .findFirst({
        where: { name: name.toLowerCase() },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });
    if (findProduct) throw new Error("Product already exists");

    // Validate image size (max 5 MB)
    const maxSize = 5 * 1024 * 1024;
    for (const img of images) {
      if (img.file.size > maxSize) {
        throw new Error(`Image ${img.file.name} exceeds the 5 MB size limit`);
      }
    }

    // Upload images to Cloudinary
    const cloudinaryResponses = await uploadImageToCloudinary(images);

    // Create the new product
    const newProduct = await prisma.product
      .create({
        data: {
          description: description.toLowerCase(),
          images: cloudinaryResponses,
          name: name.toLowerCase(),
          price,
          categoryId: findCategory.id,
          isFeatured,
          offer,
          rate: 0,
          sizes: sizes.split(",").map((size) => size.trim()),
          type: type?.toLowerCase(),
        },
        include: { category: true },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    revalidatePath("/dashboard");
    return newProduct;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

/**
 * Deletes a product by ID.
 * @param id - Product ID
 * @throws Error if the operation fails
 */
export const actionDeleteProduct = async (id: string) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    await prisma.product.delete({ where: { id } }).catch(() => {
      throw new Error("Server not responding");
    });

    revalidatePath("/dashboard");
    return;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

export const actionGetBestSeller = async () => {
  try {
    // Get best selling products (ordered by total sales quantity)
    const bestSellers = await prisma.orderItem
      .groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 10,
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    const productIds = bestSellers.map((item) => item.productId);

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true },
    });

    // Get user data if available
    const user = await getUser();
    if (!user) {
      // For non-logged-in users, return basic product data
      return products.map((product) => ({
        ...product,
        inCart: false,
        quantity: 0,
        inWishlist: false,
        _sum: bestSellers.find((bs) => bs.productId === product.id)?._sum,
      }));
    }

    // For logged-in users, fetch cart and wishlist data
    const [cartUser, wishlistUser] = await Promise.all([
      prisma.cart
        .findMany({
          where: { userId: user.id },
          include: { items: true },
        })
        .catch(() => []),
      prisma.wishlist
        .findMany({
          where: { userId: user.id },
          include: { items: true },
        })
        .catch(() => []),
    ]).catch((err) => {
      throw new Error("Server not responding");
    });

    const cartProducts = cartUser.flatMap((cart) =>
      cart.items.map((item) => ({
        id: item.productId,
        quantity: item.quantity,
      }))
    );

    const wishlistProducts = wishlistUser.flatMap((wishlist) =>
      wishlist.items.map((item) => item.productId)
    );

    // Combine all data
    return products.map((product) => {
      const cartItem = cartProducts.find((item) => item.id === product.id);
      const inWishlist = wishlistProducts.includes(product.id);
      const salesData = bestSellers.find((bs) => bs.productId === product.id);

      return {
        ...product,
        inCart: !!cartItem,
        quantity: cartItem?.quantity || 0,
        inWishlist,
        _sum: salesData?._sum,
      };
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch best sellers";
    return { errMsg: message };
  }
};

/**
 * Updates a product.
 * @param data - Product data including ID and optional fields to update
 * @throws Error if the operation fails
 */
export const actionUpdateProduct = async (data: {
  name: string | null;
  description: string | null;
  images: { type: string; image: string }[];
  price: number | null;
  isFeatured: boolean | null | undefined;
  offer: number | null;
  category: string | null;
  id: string;
  sizes: string[];
}) => {
  try {
    const {
      category,
      description,
      images,
      isFeatured,
      name,
      offer,
      price,
      id,
      sizes,
    } = data;

    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    if (!id) throw new Error("Invalid ID");

    // Validate if at least one field is provided for update
    if (
      !category &&
      !description &&
      !images.length &&
      !isFeatured &&
      !name &&
      !offer &&
      !price &&
      !sizes
    )
      throw new Error("No fields to update");

    // Fetch the existing product
    const product = await prisma.product
      .findFirst({
        where: { id },
        include: { category: true },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });
    if (!product) throw new Error("Product not found");

    const updatedData: any = {};

    // Update name if provided and different
    if (name && name !== product.name) {
      const findProduct = await prisma.product
        .findFirst({
          where: { name: name.toLowerCase() },
        })
        .catch(() => {
          throw new Error("Server not responding");
        });
      if (findProduct) throw new Error("Product already exists");
      updatedData.name = name;
    }

    // Update description if provided and different
    if (description && description !== product.description) {
      updatedData.description = description;
    }

    // Update price if provided and different
    if (price && price !== product.price) {
      updatedData.price = price;
    }

    // Update offer if provided and different

    if (offer && offer !== product.offer) {
      updatedData.offer = offer;
    }
    if (offer === 0) {
      updatedData.offer = offer;
    }
    // Update category if provided and different
    if (category && category.toLowerCase() !== product.category.name) {
      const findCategory = await prisma.category
        .findUnique({
          where: { name: category.toLowerCase().trim() },
        })
        .catch(() => {
          throw new Error("Server not responding");
        });
      if (!findCategory) throw new Error("Invalid category");
      updatedData.categoryId = findCategory.id;
    }

    // Update isFeatured if provided and different
    if (isFeatured !== product.isFeatured) {
      updatedData.isFeatured = isFeatured;
    }

    // Update sizes if provided
    if (sizes[0]) {
      updatedData.sizes = sizes[0].split(",").map((size) => size.trim());
    }

    // Handle image updates
    if (images.length > 0) {
      const findImageDef = images.find((image) => image.type === "default");
      if (!findImageDef?.image) throw new Error("Default image is required");

      const checkImages = images.filter((image) =>
        image.image.startsWith("data:image")
      );
      const imagesUploaded = images.filter((image) =>
        image.image.includes("https")
      );

      const newImages = await uploadImageToCloudinary(checkImages);
      updatedData.images = [...newImages, ...imagesUploaded].sort((a, b) =>
        a.image.localeCompare(b.image)
      );
    }

    // Update the product if there are changes
    if (Object.keys(updatedData).length > 0) {
      await prisma.product
        .update({
          where: { id },
          data: updatedData,
        })
        .catch(() => {
          throw new Error("Server not responding");
        });
    }

    revalidatePath("/dashboard");
    return;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Product Fetching ========================

/**
 * Fetches a product by ID.
 * @param id - Product ID
 * @throws Error if the operation fails
 */
export const actionGetProuct = async (id: string) => {
  try {
    const user = await getUser();

    const product = await prisma.product
      .findUnique({ where: { id }, include: { category: true } })
      .catch(() => {
        throw new Error("Server not responding");
      });
    if (!product) throw new Error("Invalid ID");

    if (user) {
      // Check if product is in cart
      const productsInCart = await prisma.cart
        .findUnique({
          where: { userId: user?.id },
          include: { items: true },
        })
        .catch((err) => {
          throw new Error("Server not responding");
        });
      const findProductInCart = productsInCart?.items.find(
        (item) => item.productId === product.id
      );

      // Check if product is in wishlist
      const productsInWishlist = await prisma.wishlist
        .findUnique({
          where: { userId: user?.id },
          include: { items: true },
        })
        .catch((err) => {
          throw new Error("Server not responding");
        });
      const findProductInWishlist = productsInWishlist?.items.find(
        (item) => item.productId === product.id
      );

      if (findProductInCart) {
        return {
          ...product,
          inCart: true,
          quantity: findProductInCart.quantity,
          inWishlist: !!findProductInWishlist, // Add inWishlist property
        };
      }

      return {
        ...product,
        inWishlist: !!findProductInWishlist, // Add inWishlist property
      };
    }

    return product;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

let page: number = 1;

/**
 * Returns the current page number for products.
 */
export const getPageProducts = async () => {
  return page;
};

/**
 * Increments the page number for products and revalidates the path.
 */
export const actionPageNextProducts = async () => {
  revalidatePath("/dashboard");
  return ++page;
};

/**
 * Decrements the page number for products and revalidates the path.
 */
export const actionPagePrevProducts = async () => {
  revalidatePath("/dashboard");
  return --page;
};

/**
 * Fetches products with pagination.
 * @param page - Current page number
 * @throws Error if the operation fails
 */
export const actionGetProucts = async (page: number) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbidden");

    if (page <= 0) page = 1;

    // Get best selling product IDs first
    const bestSellingProducts = await prisma.orderItem
      .groupBy({
        by: ["productId"],
        _sum: {
          quantity: true,
        },
        orderBy: {
          _sum: {
            quantity: "desc",
          },
        },
        take: 10,
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    const bestSellerIds = bestSellingProducts.map((item) => item.productId);

    // Get all products with bestSeller flag
    const findProducts = await prisma.product
      .findMany({
        orderBy: { createdAt: "desc" },
        include: {
          category: true,
        },
      })
      .then((products) =>
        products.map((product) => ({
          ...product,
          best: bestSellerIds.includes(product.id),
        }))
      )
      .catch(() => {
        throw new Error("Server not responding");
      });

    const { currentPage, pages, no } = pagination(findProducts, page);

    return {
      products: findProducts, // Now includes bestSeller flag
      currentPage,
      pages,
      no,
      count: findProducts.length,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

/**
 * Searches for products by name, description, or category.
 * @param params - Search query
 * @throws Error if the operation fails
 */
export const actionSearchProduct = async (params: string) => {
  try {
    const products = await prisma.product
      .findMany({
        where: {
          OR: [
            { name: { contains: params, mode: "insensitive" } },
            { description: { contains: params, mode: "insensitive" } },
            { category: { name: { contains: params, mode: "insensitive" } } },
          ],
        },
        include: { category: true },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    return products;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

/**
 * Fetches featured products.
 * @throws Error if the operation fails
 */
export const actionGetFeaturedProducts = async () => {
  try {
    const FeaturedProducts = await prisma.product
      .findMany({
        include: { category: true },
        where: { isFeatured: true },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    return FeaturedProducts;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

/**
 * Fetches products with offers.
 * @throws Error if the operation fails
 */
export const actionGetOfferProducts = async () => {
  try {
    const offerProducts = await prisma.product
      .findMany({
        include: { category: true },
        where: { offer: { gt: 0 } },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    return offerProducts;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

/**
 * Fetches products with in category use id.
 * @throws Error if the operation fails
 */
export const actionGetProductsCategory = async (id: string) => {
  try {
    const category = await prisma.category
      .findUnique({
        where: { id },
        include: { products: true },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    return { category: category };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

/**
 * Fetches users and pending users use email.
 * @throws Error if the operation fails
 */
export const actionSearchUsers = async (email: string) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    const findUsers = await prisma.user
      .findMany({
        where: { OR: [{ email: { contains: email } }] },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    const findPendingUsers = await prisma.pendingUser
      .findMany({
        where: { OR: [{ email: { contains: email } }] },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    if (findPendingUsers.length && findUsers.length)
      return [...findPendingUsers, ...findUsers];
    if (findPendingUsers.length) return findPendingUsers;
    else return findUsers;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Pagination for Users ========================

let pageUsers: number = 1;

/**
 * Returns the current page number for users.
 */
export const getPageUsers = async () => {
  return pageUsers;
};

/**
 * Increments the page number for users and revalidates the path.
 */
export const actionPageNextUsers = async () => {
  revalidatePath("/dashboard/users");
  return ++pageUsers;
};

/**
 * Decrements the page number for users and revalidates the path.
 */
export const actionPagePrevUsers = async () => {
  revalidatePath("/dashboard/users");
  return --pageUsers;
};

/**
 * Fetches users with pagination.
 * @param page - Current page number
 * @throws Error if the operation fails
 */
export const actionGetUsers = async (page: number) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    if (page <= 0) page = 1;

    const findUsers = await prisma.user
      .findMany({
        orderBy: { createdAt: "desc" },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    const { currentPage, pages, no } = pagination(findUsers, page);

    return {
      currentPage,
      pages,
      no,
      count: findUsers.length,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

let pagePendingUsers: number = 1;

/**
 * Returns the current page number for pending users.
 */
export const getPagePendingUsers = async () => {
  return pagePendingUsers;
};

/**
 * Increments the page number for pending users and revalidates the path.
 */
export const actionPageNextPendingUsers = async () => {
  revalidatePath("/dashboard/users");
  return ++pagePendingUsers;
};

/**
 * Decrements the page number for pending users and revalidates the path.
 */
export const actionPagePrevPendingUsers = async () => {
  revalidatePath("/dashboard/users");
  return --pagePendingUsers;
};

/**
 * Fetches pending users with pagination.
 * @param page - Current page number
 * @throws Error if the operation fails
 */
export const actionPendingGetUsers = async (page: number) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    if (page <= 0) page = 1;

    const findPendingUsers = await prisma.pendingUser.findMany({}).catch(() => {
      throw new Error("Server not responding");
    });

    const { currentPage, pages, no } = pagination(findPendingUsers, page);

    return {
      currentPage,
      pages,
      no,
      count: findPendingUsers.length,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

export const actionDeleteUser = async (id: string) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    // Check if user exists
    const user = await prisma.user
      .findFirst({
        where: { id },
      })
      .catch((err) => {
        return new Error("Server not responding");
      });

    if (user) {
      await prisma.user.delete({ where: { id } }).catch((err) => {
        return new Error("Server not responding");
      });
      revalidatePath("/dashboard/users", "page");
      return;
    }

    // Check if pending user exists
    const pendingUser = await prisma.pendingUser
      .findFirst({
        where: { id },
      })
      .catch((err) => {
        return new Error("Server not responding");
      });
    if (pendingUser) {
      await prisma.pendingUser.delete({ where: { id } }).catch((err) => {
        return new Error("Server not responding");
      }); // Ensure deletion from pendingUser
      revalidatePath("/dashboard/users", "page");
      return;
    }

    throw new Error("User not found");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

export const actionGetNewProducts = async () => {
  try {
    const user = await getUser();

    // Fetch the user's cart
    const cartUser = await prisma.cart
      .findMany({
        where: { userId: user?.id || "" },
        include: { items: true },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    // Fetch the user's wishlist
    const wishlistUser = await prisma.wishlist
      .findMany({
        where: { userId: user?.id || "" },
        include: { items: true },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    // Fetch the latest 8 products
    const newProducts = await prisma.product
      .findMany({
        orderBy: {
          createdAt: "desc",
        },
        skip: 0,
        take: 8,
        include: { category: true, _count: { select: { ratings: true } } },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    // Extract product IDs and quantities from the user's cart
    const cartProducts = cartUser.flatMap((cart) =>
      cart.items.map((item) => ({
        id: item.productId,
        quantity: item.quantity,
      }))
    );

    // Extract product IDs from the user's wishlist
    const wishlistProducts = wishlistUser.flatMap((wishlist) =>
      wishlist.items.map((item) => item.productId)
    );

    // Add `inCart`, `quantity`, and `inWishlist` properties to each product
    const productsWithInCartAndWishlist = newProducts.map((product) => {
      const cartItem = cartProducts.find((item) => item.id === product.id);
      const inWishlist = wishlistProducts.includes(product.id);

      return {
        ...product,
        inCart: !!cartItem,
        quantity: cartItem?.quantity || 0,
        inWishlist: inWishlist, // Add inWishlist property
      };
    });

    return { products: productsWithInCartAndWishlist };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

export const actionGetRelatedProducts = async (
  category: string,
  id: string
) => {
  try {
    const user = await getUser();

    const getRelatedProducts = await prisma.category
      .findUnique({
        where: { name: category.toLowerCase() },
        include: {
          products: {
            where: { id: { not: id } },
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { ratings: true } } },
            take: 4,
          },
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!getRelatedProducts || !getRelatedProducts.products) {
      return []; // Return empty array if no related products or category found
    }

    let products = getRelatedProducts.products;

    if (user) {
      // Fetch cart and wishlist items
      const userCart = await prisma.cart.findUnique({
        where: { userId: user.id },
        include: { items: true },
      });

      const userWishlist = await prisma.wishlist.findUnique({
        where: { userId: user.id },
        include: { items: true },
      });

      products = products.map((product) => {
        const inCart = userCart?.items.some(
          (item) => item.productId === product.id
        );
        const inWishlist = userWishlist?.items.some(
          (item) => item.productId === product.id
        );

        const cartItem = userCart?.items.find(
          (item) => item.productId === product.id
        );
        const quantity = cartItem?.quantity || 0;

        return {
          ...product,
          category: {
            name: getRelatedProducts.name,
            id: getRelatedProducts.id,
          },
          inCart: !!inCart,
          inWishlist: !!inWishlist,
          quantity: quantity,
        };
      });
    }

    if (user?.email) return products;

    return products.map((product) => ({
      ...product,
      category: {
        name: getRelatedProducts.name,
        id: getRelatedProducts.id,
      },
      inCart: false,
      inWishlist: false,
      quantity: 0,
    }));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

export const actionAddRating = async (
  rate: number,
  comment: string,
  prodId: string
) => {
  try {
    const user = await getUser();
    if (!user) {
      throw new Error("User not authenticated.");
    }

    // Input Validation
    if (rate < 1 || rate > 5) {
      throw new Error("Rating must be between 1 and 5.");
    }

    await prisma
      .$transaction(async (prisma) => {
        // Create the new rating
        await prisma.rating
          .create({
            data: {
              comment,
              rating: rate,
              userId: user.id,
              productId: prodId,
            },
          })
          .catch((err) => {
            throw new Error("Server not responding");
          });

        // Calculate the new average rating directly in Prisma
        const aggregation = await prisma.rating
          .aggregate({
            where: { productId: prodId },
            _sum: { rating: true },
            _count: { rating: true },
          })
          .catch((err) => {
            throw new Error("Server not responding");
          });

        const avgRating = Math.round(
          (aggregation._sum.rating ?? 0) / aggregation._count.rating
        );

        // Update the product's average rating
        await prisma.product.update({
          where: { id: prodId },
          data: { rate: avgRating },
        });
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    revalidatePath(`/product/${prodId}`);
    return;
  } catch (err) {
    let message = "Something went wrong!";
    if (err instanceof Error) {
      message = err.message;
    }
    return { errMsg: message };
  }
};

export const actionGetRating = async (prodId: string) => {
  try {
    const user = await getUser();
    if (user) {
      const userRating = user
        ? await prisma.rating
            .findUnique({
              where: {
                userId_productId: {
                  userId: user.id,
                  productId: prodId,
                },
              },
            })
            .catch((err) => {
              throw new Error("Server not responding");
            })
        : null;

      const ratings = await prisma.rating
        .findMany({
          where: { productId: prodId },
          include: { user: { select: { fName: true } } },
        })
        .catch((err) => {
          throw new Error("Server not responding");
        });

      const enhancedRatings = ratings.map((rating) => ({
        ...rating,
        user: {
          fName: user?.id === rating.userId ? "You" : rating.user?.fName,
        },
      }));
      return {
        rates: enhancedRatings,
        ratedUser: !!userRating,
      };
    } else {
      const ratings = await prisma.rating
        .findMany({
          where: { productId: prodId },
          include: { user: { select: { fName: true } } },
        })
        .catch((err) => {
          throw new Error("Server not responding");
        });

      const enhancedRatings = ratings.map((rating) => ({
        ...rating,
        user: {
          fName: rating.user?.fName,
        },
      }));

      return {
        rates: enhancedRatings,
      };
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong!";
    return { errMsg: message };
  }
};

interface FilterOptions {
  categories?: string[];
  priceRange?: [number, number];
  sortBy?:
    | "latest"
    | "popularity"
    | "rating"
    | "priceLow"
    | "priceHigh"
    | "topOffer";
  page?: number;
  itemsPerPage?: number;
}

export const actionFilter = async (options: FilterOptions = {}) => {
  const {
    categories,
    priceRange,
    sortBy,
    page = 1,
    itemsPerPage = 6,
  } = options;

  try {
    const user = await getUser();

    const whereClause: any = {};
    const orderByClause: any = {};

    // Filter by categories
    if (categories && categories.length > 0) {
      whereClause.category = {
        name: {
          in: categories,
        },
      };
    }

    // Filter by price range
    if (priceRange && priceRange.length === 2) {
      whereClause.price = {
        gte: priceRange[0],
        lte: priceRange[1],
      };
    }

    // Pagination
    const skip = (page - 1) * itemsPerPage;
    const take = itemsPerPage;

    if (sortBy === "rating") {
      const ratedProducts = await prisma.rating.groupBy({
        by: ["productId"],
        _avg: {
          rating: true,
        },
        orderBy: {
          _avg: {
            rating: "desc",
          },
        },
        take,
        skip,
      });

      const productIds = ratedProducts.map((r) => r.productId);

      const filteredProducts = await prisma.product.findMany({
        where: {
          ...whereClause,
          id: { in: productIds },
        },
        include: {
          category: true,
          ratings: true,
          _count: { select: { ratings: true } },
        },
      });

      const sortedProducts = productIds
        .map((id) => filteredProducts.find((p) => p.id === id))
        .filter(Boolean);

      const totalProducts = await prisma.product.count({
        where: whereClause,
      });

      const totalPages = Math.ceil(totalProducts / itemsPerPage);

      const [cartUser, wishlistUser] = await Promise.all([
        prisma.cart.findMany({
          where: { userId: user?.id || "" },
          include: { items: true },
        }),
        prisma.wishlist.findMany({
          where: { userId: user?.id || "" },
          include: { items: true },
        }),
      ]);

      const cartProducts = cartUser.flatMap((cart) =>
        cart.items.map((item) => ({
          id: item.productId,
          quantity: item.quantity,
        }))
      );

      const wishlistProducts = wishlistUser.flatMap((wishlist) =>
        wishlist.items.map((item) => item.productId)
      );

      const productsWithUserData = sortedProducts.map((product) => {
        const cartItem = cartProducts.find((item) => item.id === product?.id);
        const inWishlist = wishlistProducts.includes(product?.id || "");

        return {
          ...product,
          inCart: !!cartItem,
          quantity: cartItem?.quantity || 0,
          inWishlist: inWishlist,
        };
      });

      return {
        products: productsWithUserData,
        currentPage: page,
        totalPages: totalPages,
        totalProducts: totalProducts,
      };
    } else {
      if (sortBy) {
        switch (sortBy) {
          case "latest":
            orderByClause.createdAt = "desc";
            break;
          case "popularity":
            orderByClause.createdAt = "asc";
            break;
          case "topOffer":
            orderByClause.offer = "asc";
            break;
          case "priceLow":
            orderByClause.price = "asc";
            break;
          case "priceHigh":
            orderByClause.price = "desc";
            break;
          default:
            orderByClause.createdAt = "desc";
        }
      } else {
        orderByClause.createdAt = "desc";
      }

      const [filteredProducts, totalProducts, cartUser, wishlistUser] =
        await Promise.all([
          prisma.product.findMany({
            where: whereClause,
            orderBy: orderByClause,
            skip,
            take,
            include: {
              category: true,
              _count: { select: { ratings: true } },
            },
          }),
          prisma.product.count({
            where: whereClause,
          }),
          prisma.cart.findMany({
            where: { userId: user?.id || "" },
            include: { items: true },
          }),
          prisma.wishlist.findMany({
            where: { userId: user?.id || "" },
            include: { items: true },
          }),
        ]);

      const totalPages = Math.ceil(totalProducts / itemsPerPage);

      const cartProducts = cartUser.flatMap((cart) =>
        cart.items.map((item) => ({
          id: item.productId,
          quantity: item.quantity,
        }))
      );

      const wishlistProducts = wishlistUser.flatMap((wishlist) =>
        wishlist.items.map((item) => item.productId)
      );

      const productsWithUserData = filteredProducts.map((product) => {
        const cartItem = cartProducts.find((item) => item.id === product.id);
        const inWishlist = wishlistProducts.includes(product.id);

        return {
          ...product,
          inCart: !!cartItem,
          quantity: cartItem?.quantity || 0,
          inWishlist: inWishlist,
        };
      });

      return {
        products: productsWithUserData,
        currentPage: page,
        totalPages: totalPages,
        totalProducts: totalProducts,
      };
    }
  } catch (error) {
    console.error("Error filtering products:", error);
    const message =
      error instanceof Error ? error.message : "Something went wrong!";
    return { errMsg: message };
  }
};

export const actionGetFullUserInfo = async (id: string) => {
  try {
    const user = await getUser();
    if (!user?.id) throw new Error("User not found");
    if (user?.id !== id) throw new Error("Forbidden");
    const findUser = await prisma.user
      .findUnique({
        where: { id: id },
        select: {
          fName: true,
          lName: true,
          email: true,
          country: true,
          dateOfBirth: true,
          id: true,
          Cart: {
            select: {
              id: true,
              userId: true,
              items: {
                select: {
                  id: true,
                  productId: true,
                  quantity: true,
                  totalPrice: true,
                  product: true,

                  // Add other items fields you need here
                },
              },
              // Add other Cart fields you need here
            },
          },
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!findUser) {
      throw new Error("User not found");
    }

    return findUser;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

interface Country {
  name: string;
  flag: string;
}

interface UserUpdateData {
  fName?: string;
  lName?: string;
  dateOfBirth?: Date;
  country?: Country;
  password?: string;
  updatedAt?: Date;
}

export const actionUpdateUser = async (
  fName?: string,
  lName?: string,
  dateOfBirth?: Date,
  country?: Country,
  oldPassword?: string,
  newPassword?: string
) => {
  try {
    if (!fName && !lName && !dateOfBirth && !country && !newPassword) {
      throw new Error("No update fields provided");
    }

    const user = await getUser();
    if (!user?.id) throw new Error("No user found");

    const updateData: UserUpdateData = {};
    const errors: string[] = [];

    // First name validation and update
    if (fName) {
      const isValidFName = nameCheck(fName);
      if (!isValidFName) {
        errors.push("First name not valid");
      } else {
        updateData.fName = fName;
      }
    }

    // Last name validation and update
    if (lName) {
      const isValidLName = nameCheck(lName);
      if (!isValidLName) {
        errors.push("Last name not valid");
      } else {
        updateData.lName = lName;
      }
    }

    // Date of birth validation
    if (dateOfBirth) {
      const currentDate = new Date();
      const birthYear = dateOfBirth.getFullYear();

      if (dateOfBirth > currentDate) {
        errors.push("Date of birth cannot be in the future");
      } else if (birthYear < 1930 || birthYear > 2007) {
        errors.push("Year of birth must be between 1930 and 2007");
      } else {
        updateData.dateOfBirth = dateOfBirth;
      }
    }

    // Country validation
    if (country) {
      if (!country.name || !country.flag) {
        errors.push("Country data incomplete");
      } else {
        updateData.country = country;
      }
    }

    // Password change logic
    if (newPassword || oldPassword) {
      if (!newPassword || !oldPassword) {
        errors.push(
          "Both old and new passwords are required for password change"
        );
      } else {
        const findUser = await prisma.user
          .findUnique({
            where: { id: user.id },
            select: { password: true },
          })
          .catch((err) => {
            throw new Error("Server not responding");
          });

        if (!findUser) {
          errors.push("User not found");
        } else {
          const checkPwd = await bcrypt.compare(oldPassword, findUser.password);
          if (!checkPwd) {
            errors.push("Invalid current password");
          } else if (!passwordCheck(newPassword).map((pwd) => pwd.met)) {
            errors.push("Password does not match the qualifications ");
          } else {
            const hashPwd = await bcrypt.hash(newPassword, 10);
            updateData.password = hashPwd;
          }
        }
      }
    }

    // If any validation errors, throw them all at once
    if (errors.length > 0) {
      throw new Error(errors.join(", "));
    }

    // Only proceed with update if there's data to update
    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date(); // Always update the timestamp

      await prisma.user
        .update({
          where: { id: user.id },
          data: updateData as Prisma.UserUpdateInput, // Explicit type assertion
        })
        .catch((err) => {
          throw new Error("Server not responding");
        });
    }

    return { success: true, message: "User updated successfully" };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Get order for eact user ========================
// Get Coupon for each user

/**
 * @throws Error if the operation fails
 */

export const actionGetUserOrders = async (id?: string) => {
  try {
    const user = await getUser();
    if (!user) return [];

    const orders = await prisma.order
      .findMany({
        where: { userId: id ? id : user.id },
        orderBy: { createdAt: "desc" },
        include: { items: { include: { product: true } } },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    return orders;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Coupon ========================
// Get Coupon for each user

/**
 * @throws Error if the operation fails
 */
export const actionGetCouponCode = async () => {
  try {
    const user = await getUser();
    if (!user) throw new Error("No user found");

    await prisma.coupon
      .deleteMany({
        where: {
          expirationDate: {
            lt: new Date(),
          },
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });
    const coupons = await prisma.coupon
      .findMany({
        where: { userId: user?.id, isActive: true },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!coupons.length) return null;

    return coupons[0];
  } catch (err) {
    console.error("Error filtering products:", err);
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// Validate Coupon  code
export const actionApplyCouponCode = async (code: string) => {
  try {
    const user = await getUser();
    if (!user) throw new Error("No user found");

    const findCoupon = await prisma.coupon
      .findUnique({
        where: {
          expirationDate: {
            gt: new Date(), // Coupon is not expired
          },
          code: code, // Coupon code matches
          isActive: true, // Coupon is active
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!findCoupon) throw new Error("No valid coupon found");

    const userWithCart = await prisma.user
      .findUnique({
        where: { id: user.id },
        include: {
          Cart: { include: { items: { include: { product: true } } } },
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!userWithCart || !userWithCart.Cart) {
      throw new Error("Cart not found");
    }

    const items = userWithCart?.Cart?.items as unknown as CartItem[];

    const total =
      items?.reduce(
        (total: number, item: CartItem) =>
          total +
          item.quantity * (item?.product?.offer || item?.product?.price || 0),
        0
      ) ?? 0;

    const discountPercentage = findCoupon.discountPercentage / 100; // Convert percentage to decimal
    const discountAmount = total * discountPercentage; // Calculate discount amount
    const newTotal = total - discountAmount; // Apply discount to the total

    revalidatePath(`/checkout/${user?.id}`);

    return {
      success: true,
      message: "Coupon applied successfully",
      discountPercentage: findCoupon.discountPercentage,
      discountAmount,
      newTotal: Number(newTotal.toFixed(2)),
    };
  } catch (err) {
    console.error("Error applying coupon code:", err);
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

let pageOrders: number = 1;

/**
 * Returns the current page number for Order.
 */
export const getPageOrders = async () => {
  return pageOrders;
};

/**
 * Increments the page number for  Order and revalidates the path.
 */
export const actionPageNextOrders = async () => {
  revalidatePath("/dashboard/orders ");
  return ++pageOrders;
};

/**
 * Decrements the page number for Order and revalidates the path.
 */
export const actionPagePrevOrders = async () => {
  revalidatePath("/dashboard/orders");
  return --pageOrders;
};

export const actionGetOrders = async (page: number) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    if (page <= 0) page = 1;

    const findOrders = await prisma.order
      .findMany({
        orderBy: { createdAt: "desc" },
        include: { items: { include: { product: true } }, user: true },
      })
      .catch(() => {
        throw new Error("Server not responding");
      });

    const { currentPage, pages, no } = pagination(findOrders, page);

    return {
      currentPage,
      pages,
      no,
      count: findOrders.length,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Analytic Sales ========================
// Get last 7 days sales
// Get total sales, revenue, and orders for the last 7 days

/**
 * @throws Error if the operation fails
 */
export async function acionGetLast7DaysSales() {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    const sevenDaysAgo = startOfDay(subDays(new Date(), 7));

    const orders = await prisma.order
      .findMany({
        where: {
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        include: {
          items: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    // Group by day and calculate totals
    const dailyData = orders.reduce((acc: any, order: any) => {
      const date = order.createdAt.toISOString().split("T")[0];

      if (!acc[date]) {
        acc[date] = {
          date,
          sales: 0,
          revenue: 0,
          orders: 0,
        };
      }

      acc[date].sales += order.items.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0
      );
      acc[date].revenue += order.totalAmount;
      acc[date].orders += 1;

      return acc;
    }, {} as Record<string, { date: string; sales: number; revenue: number; orders: number }>);

    // Fill in missing days with zeros
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i))
        .toISOString()
        .split("T")[0];
      result.push(
        dailyData[date] || {
          date,
          sales: 0,
          revenue: 0,
          orders: 0,
        }
      );
    }

    return result;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
}

// ========================  Messages ========================

/**
 * @throws Error if the operation fails
 */
export async function actionGetProductsByCategory() {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    const categoriesWithCount = await prisma.category
      .findMany({
        include: {
          _count: {
            select: { products: true },
          },
        },
        orderBy: {
          products: {
            _count: "desc",
          },
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    const totalProducts = await prisma.product.count().catch((err) => {
      throw new Error("Server not responding");
    });

    return {
      categories: categoriesWithCount.map((category) => ({
        name: category.name,
        count: category._count.products,
        total: totalProducts,
      })),
      total: totalProducts,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
}

// ========================  Cards ========================
// Count Cards for Dashboard
// Count Products, Users, Orders, Revenue

/**
 * @throws Error if the operation fails
 */
export const actionCountCards = async () => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    const product_count = await prisma.product.count().catch((err) => {
      throw new Error(err);
    });

    const user_count = await prisma.user.count().catch((err) => {
      throw new Error(err);
    });

    const sales_count = await prisma.order.count().catch((err) => {
      throw new Error(err);
    });

    const revenue = await prisma.order
      .aggregate({ _sum: { totalAmount: true } })
      .catch((err) => {
        throw new Error(err);
      });

    return {
      sales_count,
      product_count,
      user_count,
      revenue: revenue._sum?.totalAmount || 0,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Messages ========================
// Create Message to contact us

/**
 * @throws Error if the operation fails
 */

export const actionCreateMessage = async (formData: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) => {
  try {
    const findUser = await prisma.user
      .findUnique({ where: { email: formData.email } })
      .catch((err) => {
        throw new Error(err);
      });

    await prisma.message
      .create({
        data: {
          email: formData.email,
          message: formData.message,
          subject: formData.subject,
          name: formData.name,
          isUser: findUser?.email ? true : false,
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    return { success: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

export const actionGetMessages = async () => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbidden");

    const messages = await prisma.message.findMany({
      orderBy: { id: "desc" },
    });
    return messages;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Analytics for Users  ========================

//  Analytic for users to see how many users are registered in the last 7 days

/**
 * @throws Error if the operation fails
 */
export async function actionGetUserStatsLast7Days() {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get verified users count per day
    const users = await prisma.user
      .groupBy({
        by: ["createdAt"],
        where: {
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        _count: {
          _all: true,
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    // Get pending users count per day
    const pendingUsers = await prisma.pendingUser
      .groupBy({
        by: ["createdAt"],
        where: {
          createdAt: {
            gte: sevenDaysAgo,
          },
        },
        _count: {
          _all: true,
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    // Format data for chart
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const result = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i)); // Get dates from 6 days ago to today
      const dayName = days[date.getDay()];
      const dateString = date.toISOString().split("T")[0];

      const userCount = users
        .filter((u) => u.createdAt.toISOString().split("T")[0] === dateString)
        .reduce((sum, item) => sum + item._count._all, 0);

      const pendingCount = pendingUsers
        .filter((u) => u.createdAt.toISOString().split("T")[0] === dateString)
        .reduce((sum, item) => sum + item._count._all, 0);

      result.push({
        day: dayName,
        users: userCount,
        pendingUsers: pendingCount,
        date: dateString,
      });
    }

    return result;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
}

// ======================== Update Order Status  ========================

// Order Status that to see what happend to order Shipping, Delivered, Cancelled,...
/**
 * @throws Error if the operation fails
 */
export const actionUpdateStatusOrder = async (
  orderId: string,
  status: OrderStatus
) => {
  const supervisor = await getSupervisor();
  if (!supervisor?.id) throw new Error("Forbbiden");

  if (!status) throw new Error("No status to update");

  try {
    await prisma.order
      .update({
        where: { id: orderId },
        data: {
          status: status,
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    revalidatePath("/dashboard/orders");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

export const actionSearchOrder = async (searchParams: string) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    // Trim and lowercase the search parameter for case-insensitive search
    const searchTerm = searchParams.trim().toLowerCase();

    const orders = await prisma.order
      .findMany({
        where: {
          OR: [
            {
              track: {
                contains: searchTerm,
                mode: "insensitive",
              },
            },
            {
              user: {
                email: {
                  contains: searchTerm,
                  mode: "insensitive",
                },
              },
            },
          ],
        },
        include: {
          user: {
            select: {
              email: true,
              fName: true,
              lName: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!orders || orders.length === 0) {
      return [];
    }

    return orders;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Get Rates  ========================

/**
 * @throws Error if the operation fails
 */
export const actionGetRatesUser = async (id: string) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    const orders = await prisma.rating
      .findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        include: { product: { include: { category: true } } },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!orders.length) return [];

    return orders;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Update Slider  ========================

/**
 * @throws Error if the operation fails
 */
export async function actionUpdateSlider(slide: Slider) {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    const id = slide.id;
    const title = slide.title;
    const subtitle = slide.subtitle;
    const description = slide.description;
    const cta = slide.buttonText;
    const link = slide.buttonLink;
    const imageFile = slide.image;

    // Validate required fields

    if (!id || !title || !imageFile) {
      throw new Error("Missing required fields: title, image file or id ");
    }

    // Upload new image if provided

    const cloudinaryResponse = await cloudinary.uploader
      .upload(imageFile, {
        folder: "products",
      })
      .catch((err) => {
        throw new Error("Server not responding to upload image");
      });

    // Update slide in database
    const updatedSlide = await prisma.slider
      .update({
        where: { id },
        data: {
          image: cloudinaryResponse.secure_url,
          title,
          subtitle,
          description,
          buttonText: cta,
          buttonLink: link,
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    revalidatePath("/dashboard/layout");

    return {
      success: true,
      message: "Slide updated successfully",
      data: updatedSlide,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
}

// ======================== Get Slider  ========================

/**
 * @throws Error if the operation fails
 */
export async function actionGetSlides() {
  try {
    return await prisma.slider
      .findMany({
        orderBy: { id: "asc" },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
}

export async function actionGetAllProducts() {
  try {
    return await prisma.product
      .findMany({
        orderBy: { id: "asc" },
        include: { category: true },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
}

// ======================== Hot Product  ========================

/**
 * Fetches the hot product from the database.
 * @throws Error if the operation fails
 */

export async function actionGetHotProduct() {
  try {
    const hotProduct = await prisma.hotProduct
      .findMany({
        include: { product: { include: { category: true } } },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    return {
      product: hotProduct[0]?.product,
      createdAt: hotProduct[0].createdAt,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
}

/**
 * Set New Hot product
 * @throws Error if the operation fails
 */

export async function actionUpdateHotProduct(id: string) {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    const findProduct = await prisma.product
      .findUnique({ where: { id: id } })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    if (!findProduct) throw new Error("No Product found");

    await prisma.hotProduct.deleteMany({}).catch((err) => {
      throw new Error("Server not responding");
    });

    const hotProduct = await prisma.hotProduct
      .create({
        data: { prodId: id },
        include: { product: { include: { category: true } } },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    revalidatePath("/dashboard/layout");
    return hotProduct?.product;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
}

// ======================== Text in Appbar  ========================

/**
 * @throws Error if the operation fails
 */
export const actionUpdateAppbarText = async (text: string) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    await prisma.appbarText.deleteMany({}).catch((err) => {
      throw new Error("Server not responding");
    });
    await prisma.appbarText
      .create({
        data: {
          text: text,
        },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    return text;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

export const actionGetText = async () => {
  try {
    const text = await prisma.appbarText
      .findMany({})
      .catch((err) => {
        throw new Error("Server not responding");
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    return text[0].text;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ========================  Shipping  ========================

/**
 *Update..  When money in cart equlas or more of Shipping get the free shipping
 * @throws Error if the operation fails
 */
export const actionUpdateShipping = async (shipping: number) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    await prisma.shipping
      .deleteMany({})
      .catch((err) => {
        throw new Error("Server not responding");
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });
    await prisma.shipping
      .create({
        data: { shipping: Number(shipping) },
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

/**
 * Get Shipping
 * @throws Error if the operation fails
 */
export const actionGetShipping = async () => {
  try {
    const shipping = await prisma.shipping
      .findMany({})
      .catch((err) => {
        throw new Error("Server not responding");
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    return shipping[0].shipping.toString();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
};

// ======================== Search for product ========================

/**
 * Search for specifics products by user.
 * @param query -  string for search
 * @throws Error if the operation fails
 */
export async function searchProducts(query: string) {
  if (!query.trim()) return [];

  try {
    const products = await prisma.product
      .findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { type: { contains: query, mode: "insensitive" } },
          ],
        },
        include: {
          category: true,
        },
        take: 12,
      })
      .catch((err) => {
        throw new Error("Server not responding");
      });

    return products;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    return { errMsg: message };
  }
}
// ======================== Helper Functions ========================

/**
 * Uploads images to Cloudinary.
 * @param images - Array of images to upload
 * @throws Error if the operation fails
 */
const uploadImageToCloudinary = async (
  images: { type: string; image: string }[]
) => {
  try {
    const supervisor = await getSupervisor();
    if (!supervisor?.id) throw new Error("Forbbiden");

    const cloudinaryResponses = await Promise.all(
      images.map(async (image) => {
        const cloudinaryResponse = await cloudinary.uploader.upload(
          image.image,
          {
            folder: "products",
          }
        );
        return { type: image.type, image: cloudinaryResponse.secure_url };
      })
    ).catch((err) => {
      throw new Error("Server not responding");
    });

    return cloudinaryResponses;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong!";
    throw new Error(message);
  }
};
