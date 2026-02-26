"use client";

import { useEffect, useState } from "react";
import ContentFilter from "./ContentFilter";
import Products from "./Products";
import ResponsiveProductsFiltration from "./ResponsiveProductsFiltration";
import { useProduct } from "@/app/_context/ProductsProvider";
import { useMenu } from "@/app/_context/CategoriesMenuProvider";

function Filter({
  categories,
  category,
}: {
  categories: Category[];
  category?: Category | null;
}) {
  const { orderFilter } = useMenu();
  const { filter } = useProduct();
  const [loading, setLoading] = useState<boolean>(false);
  const [gridSort, setGridSort] = useState<3 | 2 | 1>(3);
  const [selectedSort, setSelectedSort] = useState<SortOption>(orderFilter);
  const [pagination, setPagination] = useState<number>(1);
  const [isLarge, setIsLarge] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    const handleResize = () => {
      setIsLarge(window.innerWidth > 640); // Hide when width is 640px or less
    };

    handleResize();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="col-span-12 lg:col-span-3 hidden sm:block ">
        {isLarge && (
          <ResponsiveProductsFiltration
            setLoading={setLoading}
            loading={loading}
            selectedSort={selectedSort}
            pagination={pagination}
            setPagination={setPagination}
            categories={categories}
            category={category}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
          />
        )}
      </div>
      <div className="col-span-12 lg:col-span-9 ">
        <div className="relative w-full h-[200px] md:h-fit overflow-hidden">
          {/* Text Overlay */}
          <div className="absolute w-full top-[50%] transform -translate-y-1/2 left-[50%] -translate-x-1/2 text-center space-y-4">
            <p className="text-lg md:text-3xl font-bold  text-gray-800">
              Organic Meals Prepared
            </p>
            <p className="text-lg md:text-2xl font-semibold text-gray-800">
              Delivered to{" "}
              <span className="text-green-600 font-bold">your Home</span>
            </p>
            <p className="text-sm md:text-xl text-gray-600">
              Fully prepared & delivered nationwide.
            </p>
          </div>

          {/* Background Image */}
          <img
            src="/bacola-banner-18.jpg"
            alt="Organic Meals Banner"
            className="w-full h-full object-cover object-left rounded-sm md:object-fill"
          />
        </div>
        <div className="mt-5">
          <ContentFilter
            setLoading={setLoading}
            loading={loading}
            setGridSort={setGridSort}
            setSelectedSort={setSelectedSort}
            selectedSort={selectedSort}
            pagination={pagination}
            categories={categories}
            gridSort={gridSort}
            category={category}
            setPagination={setPagination}
          />
        </div>
        <div className="mt-3">
          <div className="text-sm flex justify-between text-slate-700 text-start mb-1 font-semibold">
            <p>Products found ({loading ? "" : filter?.totalProducts})</p>
            <p>Pages ({loading ? "" : filter?.totalPages}) </p>
          </div>
          <Products
            loading={loading}
            gridSort={gridSort}
            setPagination={setPagination}
            pagination={pagination}
          />
        </div>
      </div>
    </div>
  );
}

export default Filter;