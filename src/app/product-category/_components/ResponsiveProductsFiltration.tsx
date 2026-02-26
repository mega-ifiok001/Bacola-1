"use client";

import { SetStateAction, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from "@/components/ui/sheet";
import { DialogTitle } from "@radix-ui/react-dialog";
import { Filter } from "lucide-react";
import { actionFilter } from "@/app/dashboard/_actions/actionDashboard";
import { capitalizeIfAmpersand } from "@/lib/utils";
import Loading from "@/components/Loading";
import { useProduct, UserProduct } from "@/app/_context/ProductsProvider";

function ResponsiveProductsFiltration({
  setLoading,
  loading,
  selectedSort,
  pagination,
  categories,
  category,
  setPagination,
  selectedCategories,
  setSelectedCategories,
}: {
  setLoading: React.Dispatch<SetStateAction<boolean>>;
  setPagination: React.Dispatch<SetStateAction<number>>;
  loading: boolean;
  selectedSort: SortOption;
  pagination: number;
  categories: Category[];
  category?: Category | null;
  selectedCategories: Set<string>;
  setSelectedCategories: React.Dispatch<SetStateAction<Set<string>>>;
}) {
  return (
    <div>
      <div className="hidden sm:block">
        <ProductsFilterDesktop
          setLoading={setLoading}
          loading={loading}
          selectedSort={selectedSort}
          pagination={pagination}
          categories={categories}
          category={category}
          setPagination={setPagination}
          selectedCategories={selectedCategories}
          setSelectedCategories={setSelectedCategories}
        />
      </div>
      <div className="block sm:hidden">
        <ProductsFilterMobile
          setLoading={setLoading}
          loading={loading}
          selectedSort={selectedSort}
          pagination={pagination}
          categories={categories}
          category={category}
          setPagination={setPagination}
          selectedCategories={selectedCategories}
          setSelectedCategories={setSelectedCategories}
        />
      </div>
    </div>
  );
}

function ProductsFilterDesktop({
  setLoading,
  loading,
  selectedSort,
  pagination,
  categories,
  category,
  setPagination,
  selectedCategories,
  setSelectedCategories,
}: {
  setPagination: React.Dispatch<SetStateAction<number>>;
  setLoading: React.Dispatch<SetStateAction<boolean>>;
  loading: boolean;
  selectedSort: SortOption;
  pagination: number;
  categories: Category[];
  category?: Category | null;
  selectedCategories: Set<string>;
  setSelectedCategories: React.Dispatch<SetStateAction<Set<string>>>;
}) {
  return (
    <FilterContent
      setLoading={setLoading}
      loading={loading}
      selectedSort={selectedSort}
      pagination={pagination}
      categories={categories}
      category={category}
      setPagination={setPagination}
      selectedCategories={selectedCategories}
      setSelectedCategories={setSelectedCategories}
    />
  );
}

function ProductsFilterMobile({
  setLoading,
  loading,
  selectedSort,
  pagination,
  categories,
  category,
  setPagination,
  selectedCategories,
  setSelectedCategories,
}: {
  setPagination: React.Dispatch<SetStateAction<number>>;
  setLoading: React.Dispatch<SetStateAction<boolean>>;
  loading: boolean;
  selectedSort: SortOption;
  pagination: number;
  categories: Category[];
  category?: Category | null;
  selectedCategories: Set<string>;
  setSelectedCategories: React.Dispatch<SetStateAction<Set<string>>>;
}) {
  return (
    <Sheet>
      <SheetTrigger className="flex cursor-pointer items-center">
        <Filter className="size-4 mr-1 text-gray-800 font-semibold" />{" "}
        <p className="text-gray-800 text-sm font-semibold cursor-pointer">
          Filter Products
        </p>
      </SheetTrigger>
      <SheetContent
        side={"left"}
        className="overflow-y-scroll h-[100vh] scrollbar-custom-sheet outline-none"
      >
        <SheetHeader>
          <DialogTitle />
          <FilterContent
            setLoading={setLoading}
            loading={loading}
            selectedSort={selectedSort}
            pagination={pagination}
            categories={categories}
            category={category}
            setPagination={setPagination}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
          />
        </SheetHeader>
      </SheetContent>
    </Sheet>
  );
}

const FilterContent = ({
  setLoading,
  loading,
  selectedSort,
  pagination,
  categories,
  category,
  setPagination,
  selectedCategories,
  setSelectedCategories,
}: {
  setPagination: React.Dispatch<SetStateAction<number>>;
  setLoading: React.Dispatch<SetStateAction<boolean>>;
  loading: boolean;
  selectedSort: SortOption;
  pagination: number;
  categories: Category[];
  category?: Category | null;
  selectedCategories: Set<string>;
  setSelectedCategories: React.Dispatch<SetStateAction<Set<string>>>;
}) => {
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 900]);

  const { setFilter, setProducts } = useProduct();

 const fetchFilteredProducts = async (resetPagination?: number) => {
  setLoading(true);

  try {
    // 1. Determine categories to send
    const categoriesToFilter = category?.name
      ? [category.name]
      : selectedCategories.size > 0
      ? Array.from(selectedCategories)
      : [];

    // 2. Reset to page 1 if requested (better name: resetPagination)
    const targetPage = resetPagination ? 1 : pagination;
    if (resetPagination) {
      setPagination(1);
    }

    // 3. Prepare the payload (for clarity & debugging)
    const payload = {
      categories: categoriesToFilter,
      priceRange,
      sortBy: selectedSort,
      page: targetPage,
    };

    // ────────────────────────────────────────────────
    //              VERY IMPORTANT: Log what we SEND
    // ────────────────────────────────────────────────
    console.log("→ Sending to actionFilter:", {
      categoriesSent: payload.categories,
      priceRangeSent: payload.priceRange,
      sortBySent: payload.sortBy,
      pageSent: payload.page,
      // optional: full payload for deep inspection
      fullPayload: payload,
    });

    // 4. Make the actual request
    const productsFilter = await actionFilter(payload);

    // ────────────────────────────────────────────────
    //              Log what we RECEIVE
    // ────────────────────────────────────────────────
    console.log("← actionFilter returned:", {
      productsCount: productsFilter?.products?.length ?? "missing products key",
      totalProducts: productsFilter?.totalProducts ?? 0,
      currentPage: productsFilter?.currentPage ?? 0,
      totalPages: productsFilter?.totalPages ?? 0,
      firstFewProducts:
        productsFilter?.products?.slice(0, 3)?.map((p) => ({
          id: p.id,
          name: p.name || "(no name)",
          price: p.price ?? "no price",
        })) ?? [],
      error: "errMsg" in productsFilter ? productsFilter.errMsg : undefined,
      // full response (collapse in console if too big)
      // rawResponse: productsFilter,
    });

    // 5. Handle error shape
    if ("errMsg" in productsFilter && productsFilter.errMsg) {
      throw new Error(productsFilter.errMsg);
    }

    // 6. Update filter state safely
    if ("currentPage" in productsFilter) {
      setFilter({
        currentPage: productsFilter.currentPage ?? 0,
        totalPages: productsFilter.totalPages ?? 0,
        totalProducts: productsFilter.totalProducts ?? 0,
      });
    }

    // 7. Update products (safe empty fallback)
    setProducts((productsFilter.products ?? []) as unknown as UserProduct[]);

  } catch (err) {
    console.error("Filter error:", err);
    // Optional: reset UI to empty state on error
    setProducts([]);
    setFilter({ currentPage: 0, totalPages: 0, totalProducts: 0 });
  } finally {
    setLoading(false);
  }
};

  // re-fetch products pagination
  useEffect(() => {
    fetchFilteredProducts();
    window.scrollTo({ top: 200, behavior: "smooth" });
  }, [pagination]);

  // Reset selected categories when category prop changes
  useEffect(() => {
    setSelectedCategories(new Set());
  }, [category?.name]);

  // Fetch products when filters change
  useEffect(() => {
    fetchFilteredProducts();
  }, [selectedSort]);

  const handlePriceChange = (value: [number, number]) => {
    setPriceRange(value);
  };

  const handleCategoryChange = (categoryName: string) => {
    // Don't allow changing categories if a specific category is passed
    if (category?.name) return;

    setSelectedCategories((prev) => {
      const newSelected = new Set(prev);
      newSelected.has(categoryName)
        ? newSelected.delete(categoryName)
        : newSelected.add(categoryName);
      return newSelected;
    });
  };

  const handleSelectAllCategories = (selectAll: boolean) => {
    // Don't allow changing categories if a specific category is passed
    if (category?.name) return;

    setSelectedCategories(
      selectAll ? new Set(categories.map((c) => c.name)) : new Set()
    );
  };

  return (
    <div className="space-y-6 bg-white">
      <div className="text-slate-800 font-semibold text-sm mb-4 text-start">
        {category ? "CATEGORY" : "FILTER CATEGORIES"}
      </div>

      {/* Category Selection */}
      <div>
        {!category && (
          <>
            <div className="flex items-center space-x-2 mb-3">
              <Checkbox
                id="all"
                className="border-gray-300"
                checked={
                  selectedCategories.size === 0 ||
                  selectedCategories.size === categories.length
                }
                onCheckedChange={(checked) =>
                  handleSelectAllCategories(checked === true)
                }
              />
              <label
                htmlFor="all"
                className="text-sm text-gray-700 cursor-pointer hover:text-cyan-600"
              >
                {selectedCategories.size === 0 ||
                selectedCategories.size === categories.length
                  ? "All Categories"
                  : `${selectedCategories.size} Selected`}
              </label>
            </div>

            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center space-x-2 mb-3">
                <Checkbox
                  id={cat.id}
                  className="border-gray-300"
                  checked={selectedCategories.has(cat.name)}
                  onCheckedChange={() => handleCategoryChange(cat.name)}
                />
                <label
                  htmlFor={cat.id}
                  className="text-sm text-gray-700 cursor-pointer hover:text-cyan-600"
                >
                  {capitalizeIfAmpersand(cat.name)}
                </label>
              </div>
            ))}
          </>
        )}

        {category && (
          <div key={category.id} className="flex items-center space-x-2 mb-3">
            <Checkbox
              id={category.id}
              className="border-gray-300"
              checked={true}
              disabled
            />
            <label
              htmlFor={category.id}
              className="text-sm text-gray-700 cursor-pointer hover:text-cyan-600"
            >
              {capitalizeIfAmpersand(category.name)}
            </label>
          </div>
        )}
      </div>

      {/* Price Filter */}
      <div>
        <div className="text-slate-800 font-semibold text-sm mb-4 text-start">
          FILTER PRICE
        </div>
        <div className="mb-4">
          <Slider
            min={0}
            max={900}
            value={priceRange}
            onValueChange={handlePriceChange}
            step={1}
            className="w-full"
          />
        </div>
        <p className="text-sm text-gray-600 mt-2">
          Price:{" "}
          <span>
            <span className="text-slate-900 font-semibold">
              ${priceRange[0]}
            </span>{" "}
            —
            <span className="text-slate-900 font-semibold">
              ${priceRange[1]}
            </span>
          </span>
        </p>
        <Button
          disabled={loading}
          onClick={() => fetchFilteredProducts(1)}
          className="w-full mt-3 bg-pink-700 hover:bg-pink-800 text-white py-2 rounded-md transition-colors duration-200"
        >
          {loading ? <Loading /> : "Apply Filters"}
        </Button>

        <img src="/sidebar-banner.gif" className="mt-14" alt="Sidebar Banner" />
      </div>
    </div>
  );
};

export default ResponsiveProductsFiltration;
