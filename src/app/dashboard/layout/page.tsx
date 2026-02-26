import {
  actionGetHotProduct,
  actionGetShipping,
  actionGetSlides,
  actionGetText,
} from "../_actions/actionDashboard";
import AppBarText from "./_components/AppBarText";
import HotProduct, { ProductWithCategory } from "./_components/HotProduct";
import Shipping from "./_components/Shipping";
import Slider from "./_components/Slider";

async function page() {
  let sliders: Slider[] = [];
  let hotProduct: ProductWithCategory | null = null;
  let textAppbar: string = "";
  let shipping: string = "";

  try {
    sliders = (await actionGetSlides()) as Slider[];
    if ("errMsg" in sliders) {
      if (sliders.errMsg) throw new Error(sliders.errMsg as string);
    }
  } catch (err) {
    console.error("Something went Error!", err);
  }

  try {
    const product = await actionGetHotProduct();
    hotProduct = product.product ?? null;

    if ("errMsg" in product) {
      if (product.errMsg) throw new Error(product.errMsg as string);
    }
  } catch (err) {
    console.error("Something went Error!", err);
  }

  try {
    const textResult = await actionGetText();
    textAppbar = typeof textResult === "string" ? textResult : "";

    if (!textAppbar) throw new Error("Filed fetch text Appbar");
  } catch (err) {
    console.error("Something went Error!", err);
  }
  try {
    const shippingResult = await actionGetShipping();
    shipping = typeof shippingResult === "string" ? shippingResult : "";

    if (!shipping) throw new Error("Failed fetch text Appbar");
  } catch (err) {
    console.error("Something went Error!", err);
  }

  return (
    <div>
      <p className="font-semibold text-2xl mb-5 hidden md:flex text-slate-600">
        Layout Management
      </p>
      <div>
        <AppBarText textAppbar={textAppbar} />
        <Shipping shipping={shipping} />
        <Slider sliders={sliders} />
        <HotProduct product={hotProduct} />
      </div>
    </div>
  );
}

export default page;
