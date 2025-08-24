import re
from playwright.sync_api import sync_playwright, Page, expect

def verify_pdf_feature(page: Page):
    """
    This script verifies the PDF generation feature by navigating through the app,
    creating the necessary data, and clicking the "Print to PDF" button.
    """

    # 1. Start the dev server and navigate to the app
    page.goto("http://localhost:5173/")

    # 2. Login
    # Expect the welcome screen and click the enter button
    expect(page.get_by_role("button", name="ورود به سامانه")).to_be_visible(timeout=30000)
    page.get_by_role("button", name="ورود به سامانه").click()

    # Expect the login modal and fill in the credentials
    expect(page.get_by_placeholder("کد ملی")).to_be_visible()
    page.get_by_placeholder("کد ملی").fill("5850008985")
    page.get_by_placeholder("رمز عبور").fill("64546")
    page.get_by_role("button", name="ورود").click()

    # 3. Create a hospital
    expect(page.get_by_role("button", name="افزودن بیمارستان جدید")).to_be_visible()
    page.get_by_role("button", name="افزودن بیمارستان جدید").click()

    page.get_by_placeholder("نام بیمارستان").fill("Test Hospital")
    page.get_by_placeholder("استان").fill("Test Province")
    page.get_by_placeholder("شهر").fill("Test City")
    page.get_by_placeholder("نام سوپروایزر").fill("Test Supervisor")
    page.get_by_placeholder("کد ملی سوپروایزر").fill("1234567890")
    page.get_by_placeholder("رمز عبور سوپروایزر").fill("password")
    page.get_by_role("button", name="ذخیره").click()

    # 4. Select the hospital
    page.get_by_text("Test Hospital").click()

    # 5. Create a department
    expect(page.get_by_role("button", name="افزودن بخش جدید")).to_be_visible()
    page.get_by_role("button", name="افزودن بخش جدید").click()

    page.get_by_placeholder("نام بخش").fill("Test Department")
    page.get_by_placeholder("نام مسئول").fill("Test Manager")
    page.get_by_placeholder("کد ملی مسئول").fill("0987654321")
    page.get_by_placeholder("رمز عبور مسئول").fill("password")
    page.get_by_placeholder("تعداد پرسنل").fill("10")
    page.get_by_placeholder("تعداد تخت").fill("20")
    page.get_by_role("button", name="ذخیره").click()

    # 6. Create a checklist template
    page.get_by_role("button", name=re.compile(r"مدیریت اعتباربخشی")).click()
    page.get_by_role("button", name="بازگشت").click() # go back to department list

    page.get_by_role("button", name=re.compile(r"مدیریت چک‌لیست‌ها")).click()

    expect(page.get_by_role("button", name="ساخت قالب جدید")).to_be_visible()
    page.get_by_role("button", name="ساخت قالب جدید").click()

    page.get_by_placeholder("نام قالب").fill("Test Checklist")
    page.get_by_role("button", name="اضافه کردن دسته").click()
    page.get_by_placeholder("نام دسته").fill("Test Category")
    page.get_by_role("button", name="اضافه کردن آیتم").click()
    page.get_by_placeholder("شرح آیتم").fill("Test Item")
    page.get_by_role("button", name="ذخیره قالب").click()
    page.get_by_role("button", name="بازگشت").click()

    # 7. Select the department
    page.get_by_text("Test Department").click()

    # 8. Create a staff member
    expect(page.get_by_role("button", name="افزودن پرسنل جدید")).to_be_visible()
    page.get_by_role("button", name="افزودن پرسنل جدید").click()

    page.get_by_placeholder("نام و نام خانوادگی").fill("Test Staff")
    page.get_by_placeholder("سمت").fill("Test Role")
    page.get_by_role("button", name="ذخیره").click()

    # 9. Select the staff member
    page.get_by_text("Test Staff").click()

    # 10. Create an assessment
    # Select a month, e.g., "مهر"
    page.get_by_role("button", name="مهر").click()

    # Select the checklist template
    page.get_by_role("button", name="Test Checklist").click()

    # Save the assessment with default scores
    page.get_by_role("button", name="تایید و ذخیره نمرات").click()

    # 11. Screenshot and test the button
    # The view should now be on the assessment details page
    expect(page.get_by_role("button", name="خروجی PDF")).to_be_visible()

    page.screenshot(path="jules-scratch/verification/pdf_button_visible.png")

    pdf_button = page.get_by_role("button", name="خروجی PDF")
    pdf_button.click()

    # Assert that the button text changes to the loading state
    expect(page.get_by_role("button", name="در حال ایجاد...")).to_be_visible()

    # Take another screenshot to show the loading state
    page.screenshot(path="jules-scratch/verification/pdf_button_loading.png")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_pdf_feature(page)
            print("Verification script completed successfully.")
        except Exception as e:
            print(f"Verification script failed: {e}")
            page.screenshot(path="jules-scratch/verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    main()
